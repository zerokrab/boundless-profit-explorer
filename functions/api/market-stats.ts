/**
 * GET /api/market-stats
 *
 * Fetches daily market statistics from the Boundless Explorer's RSC endpoint,
 * extracts the time-series JSON, and returns a clean array of daily buckets.
 *
 * Key terminology:
 *   total_cycles        = all computation cycles across the network
 *   total_program_cycles = cycles from orders on the open market (ZK proof requests)
 *   povwCycles          = total_cycles - total_program_cycles (Proof-of-Verifiable-Work mining)
 *
 * Data source: https://explorer.boundless.network/base/stats (RSC flight data)
 *
 * KV binding: EPOCHS_CACHE (key: "market-stats")
 */

interface Env {
  EPOCHS_CACHE: KVNamespace;
}

/** Raw daily bucket from the explorer's RSC payload. */
interface StatsBucket {
  timestamp: number;
  timestamp_iso: string;
  total_cycles: string;
  total_program_cycles: string;
  total_requests_locked: number;
  total_fulfilled: number;
  locked_orders_fulfillment_rate: number;
  total_fees_locked: string;
  total_variable_cost: string;
  total_fixed_cost: string;
  chain_id: number;
  epoch_number_start: number | null;
}

/** Cleaned bucket returned to the frontend. */
export interface MarketStatsBucket {
  date: string;                // YYYY-MM-DD
  totalCycles: number;         // all computation cycles
  povwCycles: number;          // PoVW mining cycles  (= totalCycles - marketCycles)
  marketCycles: number;       // open-market program cycles (= total_program_cycles)
  pctMarket: number;           // marketCycles / totalCycles * 100
  ordersLocked: number;
  ordersFulfilled: number;
  fulfillmentRate: number;    // 0-100
}

const UPSTREAM = 'https://explorer.boundless.network/base/stats';
const CACHE_KEY = 'market-stats-v2';
const CACHE_TTL_SECONDS = 7200; // 2 hours

/**
 * Extract the JSON array from the RSC flight-data payload.
 * The payload is a mix of React flight instructions and embedded JSON.
 * We grep for the array that starts with {"chain_id":8453 and parse it.
 */
function extractStatsArray(rscText: string): StatsBucket[] {
  const startMarker = '[{"chain_id":';
  const startIdx = rscText.indexOf(startMarker);
  if (startIdx === -1) {
    throw new Error('Could not find stats JSON array in RSC payload');
  }

  // Walk forward to find the matching closing bracket
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < rscText.length; i++) {
    if (rscText[i] === '[') depth++;
    else if (rscText[i] === ']') depth--;
    if (depth === 0) {
      endIdx = i + 1;
      break;
    }
  }

  if (endIdx === -1) {
    throw new Error('Could not find end of stats JSON array');
  }

  const jsonStr = rscText.slice(startIdx, endIdx);
  // Handle RSC date references like "$D2025-12-01T00:00:00.000Z"
  // by stripping the $D prefix — these appear inside timestamp_iso fields
  const cleaned = jsonStr.replace(/"\$D([^"]+)"/g, '"$1"');

  return JSON.parse(cleaned) as StatsBucket[];
}

function normaliseBuckets(buckets: StatsBucket[]): MarketStatsBucket[] {
  return buckets
    .filter(b => Number(b.total_cycles) > 0) // skip empty buckets
    .map(b => {
      const totalCycles = Number(BigInt(b.total_cycles));
      // total_program_cycles = market/program cycles (orders on the open market)
      const marketCycles = Number(BigInt(b.total_program_cycles));
      // PoVW = total - market (mining cycles)
      const povwCycles = Math.max(0, totalCycles - marketCycles);
      const pctMarket = totalCycles > 0 ? (marketCycles / totalCycles) * 100 : 0;

      const ts = b.timestamp_iso || new Date(b.timestamp * 1000).toISOString();
      const date = ts.slice(0, 10);

      return {
        date,
        totalCycles,
        povwCycles,
        marketCycles,
        pctMarket: parseFloat(pctMarket.toFixed(2)),
        ordersLocked: b.total_requests_locked,
        ordersFulfilled: b.total_fulfilled,
        fulfillmentRate: parseFloat(String(b.locked_orders_fulfillment_rate)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // 1. Try KV cache first
  const cached = await env.EPOCHS_CACHE.get(CACHE_KEY);
  if (cached) {
    return new Response(cached, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
  }

  // 2. Fetch fresh data from upstream RSC endpoint
  try {
    const upstream = await fetch(UPSTREAM, {
      headers: {
        'RSC': '1',
        'Accept': 'text/x-component',
      },
    });
    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }
    const rscText = await upstream.text();
    const raw = extractStatsArray(rscText);
    const normalised = normaliseBuckets(raw);
    const body = JSON.stringify(normalised);

    // 3. Store in KV with TTL
    await env.EPOCHS_CACHE.put(CACHE_KEY, body, {
      expirationTtl: CACHE_TTL_SECONDS,
    });

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });
  } catch (err) {
    // 4. Graceful degradation — return stale KV data if available
    const stale = await env.EPOCHS_CACHE.get(CACHE_KEY);
    if (stale) {
      return new Response(stale, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'STALE',
          'Cache-Control': 'no-store',
        },
      });
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: 'Failed to fetch market stats', detail: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};