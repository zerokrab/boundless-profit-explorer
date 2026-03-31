/**
 * GET /api/epochs
 *
 * Proxies https://explorer.boundless.network/api/mining, normalises the
 * entries into the EpochData shape expected by the frontend, and caches
 * the result in KV for 2 hours.
 *
 * KV binding: EPOCHS_CACHE (key: "epochs")
 *
 * Response headers:
 *   X-Cache: HIT | MISS
 *   Cache-Control: public, max-age=7200
 */

interface Env {
  EPOCHS_CACHE: KVNamespace;
}

interface MiningEntry {
  epoch: number;
  epoch_start_time: number;
  epoch_end_time: number;
  num_participants: number;
  total_capped_rewards: string; // bigint string, 1e18-scaled ZKC
  total_work: string;           // bigint string, raw cycles
}

interface MiningResponse {
  povwEpochs: {
    entries: MiningEntry[];
  };
}

export interface EpochData {
  epoch: number;
  timestamp: string;        // ISO string from epoch_start_time
  zkc_price_usd: number;
  total_cycles: number;     // raw cycles as number
  mining_rewards_zkc: number;
}

const UPSTREAM = 'https://explorer.boundless.network/api/mining';
const CACHE_KEY = 'epochs';
const CACHE_TTL_SECONDS = 7200; // 2 hours

/** Fetch ZKC price for a given date (YYYY-MM-DD) from the Explorer API */
async function fetchZkcPrice(date: string): Promise<number> {
  const res = await fetch(
    `https://explorer.boundless.network/api/zkc_price?date=${date}`
  );
  if (!res.ok) return 0;
  const json = await res.json<{ price: number }>();
  return json.price ?? 0;
}

/** Format a Unix timestamp to YYYY-MM-DD */
function toDateKey(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

/** Normalise raw MiningEntry → EpochData */
async function normaliseEntries(entries: MiningEntry[]): Promise<EpochData[]> {
  // Fetch all unique ZKC prices in parallel (one per epoch date)
  const dateKeys = entries.map((e) => toDateKey(e.epoch_start_time));
  const uniqueDates = [...new Set(dateKeys)];
  const priceMap: Record<string, number> = {};
  await Promise.all(
    uniqueDates.map(async (date) => {
      priceMap[date] = await fetchZkcPrice(date);
    })
  );

  return entries.map((e, i) => ({
    epoch: e.epoch,
    timestamp: new Date(e.epoch_start_time * 1000).toISOString(),
    zkc_price_usd: priceMap[dateKeys[i]] ?? 0,
    // total_work is raw cycles as a bigint string
    total_cycles: Number(BigInt(e.total_work)),
    // total_capped_rewards is 1e18-scaled ZKC
    mining_rewards_zkc: Number(BigInt(e.total_capped_rewards)) / 1e18,
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

  // 2. Fetch fresh data from upstream
  try {
    const upstream = await fetch(UPSTREAM);
    if (!upstream.ok) {
      throw new Error(`Upstream returned ${upstream.status}`);
    }
    const data = await upstream.json<MiningResponse>();
    const entries = data?.povwEpochs?.entries ?? [];
    const normalised = await normaliseEntries(entries);
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
    return new Response(JSON.stringify({ error: 'Failed to fetch epoch data', detail: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
