/**
 * GET /api/epochs
 *
 * Proxies https://explorer.boundless.network/api/base/mining, normalises the
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

const UPSTREAM = 'https://explorer.boundless.network/api/base/mining';
const CACHE_KEY = 'epochs';
const CACHE_TTL_SECONDS = 7200; // 2 hours

/** Normalise raw MiningEntry → EpochData, excluding the ongoing (latest) epoch */
function normaliseEntries(entries: MiningEntry[]): EpochData[] {
  // zkc_price_usd is not used in any calculation (computePovwRate only needs
  // mining_rewards_zkc and total_cycles), so we skip the per-epoch price
  // fetches that would otherwise exhaust the Worker subrequest limit (~100 calls).
  //
  // The API returns entries sorted by epoch descending. The first entry is the
  // ongoing epoch (still accumulating work), so we skip it.
  const sorted = [...entries].sort((a, b) => b.epoch - a.epoch);
  const completed = sorted.slice(1); // skip the ongoing epoch

  return completed.map((e) => ({
    epoch: e.epoch,
    timestamp: new Date(e.epoch_start_time * 1000).toISOString(),
    zkc_price_usd: 0,
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
    const normalised = normaliseEntries(entries);
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
