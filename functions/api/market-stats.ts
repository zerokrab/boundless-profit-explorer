/**
 * GET /api/market-stats
 *
 * Fetches daily market statistics from the Boundless Explorer's RSC endpoint,
 * groups them by epoch (2 days ≈ 1 epoch), and returns per-epoch market data.
 *
 * Key terminology (CORRECTED):
 *   total_program_cycles  = Market cycles (ZK proof execution orders on the market)
 *   total_cycles          = Market cycles + other overhead (~2% diff)
 *   PoVW cycles           = NOT in this endpoint — comes from total_work in /api/base/mining
 *
 * Data source: https://explorer.boundless.network/base/stats (RSC flight data)
 *
 * KV binding: EPOCHS_CACHE (key: "market-stats-v4")
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

/** Per-epoch market stats returned to the frontend. */
export interface MarketStatsBucket {
  epoch: number;
  marketCycles: number;       // total_program_cycles summed over 2 days (= market ZK proof orders)
  totalCycles: number;         // total_cycles summed over 2 days (= market + small overhead diff)
  ordersLocked: number;
  ordersFulfilled: number;
  fulfillmentRate: number;    // 0-100
}

const UPSTREAM = 'https://explorer.boundless.network/base/stats';
const CACHE_KEY = 'market-stats-v4';
const CACHE_TTL_SECONDS = 7200; // 2 hours

/**
 * Extract the JSON array from the RSC flight-data payload.
 * The payload is a mix of React flight instructions and embedded JSON.
 * We grep for the array that starts with {\"chain_id\":8453 and parse it.
 */
function extractStatsArray(rscText: string): StatsBucket[] {
  const startMarker = '[{\"chain_id\":';
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
  // Handle RSC date references like \"$D2025-12-01T00:00:00.000Z\"
  // by stripping the $D prefix — these appear inside timestamp_iso fields
  const cleaned = jsonStr.replace(/"\\$D([^"]+)"/g, '"$1"');

  return JSON.parse(cleaned) as StatsBucket[];
}

/**
 * Group daily buckets by epoch_number_start, sum cycle counts,
 * and exclude the latest epoch (which may be in-progress).
 */
function groupByEpoch(buckets: StatsBucket[]): MarketStatsBucket[] {
  // Filter out empty buckets and those without an epoch number
  const valid = buckets.filter(
    b => Number(b.total_cycles) > 0 && b.epoch_number_start !== null
  );

  // Group by epoch
  const grouped = new Map<number, {
    marketCycles: number;
    totalCycles: number;
    ordersLocked: number;
    ordersFulfilled: number;
    fulfillmentRateSum: number;
    fulfillmentCount: number;
  }>();

  for (const b of valid) {
    const epoch = b.epoch_number_start!;
    const existing = grouped.get(epoch);
    const marketCycles = Number(BigInt(b.total_program_cycles));
    const totalCycles = Number(BigInt(b.total_cycles));

    if (existing) {
      existing.marketCycles += marketCycles;
      existing.totalCycles += totalCycles;
      existing.ordersLocked += b.total_requests_locked;
      existing.ordersFulfilled += b.total_fulfilled;
      existing.fulfillmentRateSum += b.locked_orders_fulfillment_rate;
      existing.fulfillmentCount += 1;
    } else {
      grouped.set(epoch, {
        marketCycles,
        totalCycles,
        ordersLocked: b.total_requests_locked,
        ordersFulfilled: b.total_fulfilled,
        fulfillmentRateSum: b.locked_orders_fulfillment_rate,
        fulfillmentCount: 1,
      });
    }
  }

  // Sort by epoch ascending and exclude the latest (in-progress) epoch
  const epochs = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0]);

  // The last epoch may still be in-progress — exclude it
  const completed = epochs.slice(0, -1);

  return completed.map(([epoch, data]) => ({
    epoch,
    marketCycles: data.marketCycles,
    totalCycles: data.totalCycles,
    ordersLocked: data.ordersLocked,
    ordersFulfilled: data.ordersFulfilled,
    fulfillmentRate: parseFloat(
      (data.fulfillmentRateSum / data.fulfillmentCount).toFixed(1)
    ),
  }));
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
    const normalised = groupByEpoch(raw);
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