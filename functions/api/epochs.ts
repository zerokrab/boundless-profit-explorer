/**
 * GET /api/epochs
 *
 * Proxies https://explorer.boundless.network/api/base/mining, normalises the
 * entries into the EpochData shape expected by the frontend, and caches
 * the result in KV for 2 hours.
 *
 * ZKC prices are fetched per-epoch from the /api/zkc_price endpoint and
 * cached separately in KV (key: "epoch-prices") to avoid re-fetching on
 * every invocation.
 *
 * KV binding: EPOCHS_CACHE (keys: "epochs", "epoch-prices")
 *
 * Response headers:
 *   X-Cache: HIT | MISS | STALE
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
const PRICES_CACHE_KEY = 'epoch-prices';
const CACHE_TTL_SECONDS = 7200; // 2 hours

/** Derive a YYYY-MM-DD date string from a unix timestamp */
function toDateKey(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().slice(0, 10);
}

/** Fetch ZKC price for a single date from the Boundless explorer */
async function fetchZkcPrice(date: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://explorer.boundless.network/api/zkc_price?date=${date}`
    );
    if (!res.ok) return null;
    const json = await res.json<{ price: number }>();
    return json.price ?? null;
  } catch {
    return null;
  }
}

/**
 * Build a map of date-string → zkc_price_usd for all unique dates
 * referenced by the given epoch entries. Uses KV-cached prices when
 * available and only fetches missing dates from the upstream API
 * (parallelised, respecting the 50-subrequest limit).
 */
async function buildPriceMap(
  entries: MiningEntry[],
  env: Env
): Promise<Map<string, number>> {
  // 1. Load cached prices from KV
  const cachedPricesRaw = await env.EPOCHS_CACHE.get(PRICES_CACHE_KEY);
  const cachedPrices: Record<string, number> = cachedPricesRaw
    ? JSON.parse(cachedPricesRaw)
    : {};

  // 2. Collect unique dates needed
  const uniqueDates = new Set<string>();
  for (const e of entries) {
    uniqueDates.add(toDateKey(e.epoch_start_time));
  }

  // 3. Identify dates missing from cache
  const missingDates = [...uniqueDates].filter((d) => !(d in cachedPrices));

  // 4. Fetch missing prices in parallel batches
  //    (Cloudflare Workers free plan: 50 subrequests; paid: 1000)
  const BATCH_SIZE = 50;
  for (let i = 0; i < missingDates.length; i += BATCH_SIZE) {
    const batch = missingDates.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (date) => {
        const price = await fetchZkcPrice(date);
        return { date, price };
      })
    );
    for (const { date, price } of results) {
      if (price !== null) {
        cachedPrices[date] = price;
      }
    }
  }

  // 5. Store updated price map back to KV
  await env.EPOCHS_CACHE.put(PRICES_CACHE_KEY, JSON.stringify(cachedPrices), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  // Convert to Map for lookup
  const priceMap = new Map<string, number>();
  for (const [date, price] of Object.entries(cachedPrices)) {
    priceMap.set(date, price);
  }
  return priceMap;
}

/** Normalise raw MiningEntry → EpochData, excluding the ongoing (latest) epoch */
function normaliseEntries(
  entries: MiningEntry[],
  priceMap: Map<string, number>
): EpochData[] {
  // The API returns entries sorted by epoch descending. The first entry is the
  // ongoing epoch (still accumulating work), so we skip it.
  const sorted = [...entries].sort((a, b) => b.epoch - a.epoch).slice(0, 101);
  const completed = sorted.slice(1); // skip the ongoing epoch

  return completed.map((e) => {
    const dateKey = toDateKey(e.epoch_start_time);
    return {
      epoch: e.epoch,
      timestamp: new Date(e.epoch_start_time * 1000).toISOString(),
      zkc_price_usd: priceMap.get(dateKey) ?? 0,
      // total_work is raw cycles as a bigint string
      total_cycles: Number(BigInt(e.total_work)),
      // total_capped_rewards is 1e18-scaled ZKC
      mining_rewards_zkc: Number(BigInt(e.total_capped_rewards)) / 1e18,
    };
  });
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

    // 3. Build price map (uses KV cache, only fetches missing dates)
    const priceMap = await buildPriceMap(entries, env);

    // 4. Normalise with prices
    const normalised = normaliseEntries(entries, priceMap);
    const body = JSON.stringify(normalised);

    // 5. Store in KV with TTL
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
    // 6. Graceful degradation — return stale KV data if available
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
    return new Response(
      JSON.stringify({ error: 'Failed to fetch epoch data', detail: message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};