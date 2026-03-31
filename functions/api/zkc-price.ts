/**
 * GET /api/zkc-price
 *
 * Returns the current ZKC/USD price with 24h change, sourced from
 * https://explorer.boundless.network/api/zkc_price?date=YYYY-MM-DD
 *
 * Response: { price: number, change_24h_pct: number | null, timestamp: string }
 *
 * KV binding: EPOCHS_CACHE (key: "zkc-price")
 * Cache TTL: 5 minutes
 */

interface Env {
  EPOCHS_CACHE: KVNamespace;
}

interface ZkcPriceResponse {
  price: number;
  change_24h_pct: number | null;
  timestamp: string;
}

const CACHE_KEY = 'zkc-price';
const CACHE_TTL_SECONDS = 300; // 5 minutes

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function fetchPrice(date: string): Promise<number | null> {
  const res = await fetch(
    `https://explorer.boundless.network/api/zkc_price?date=${date}`
  );
  if (!res.ok) return null;
  const json = await res.json<{ price: number }>();
  return json.price ?? null;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // 1. Try KV cache
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

  // 2. Fetch today + yesterday prices in parallel for 24h change
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const [todayPrice, yesterdayPrice] = await Promise.all([
    fetchPrice(toDateKey(now)),
    fetchPrice(toDateKey(yesterday)),
  ]);

  if (todayPrice === null) {
    // Serve stale if available
    const stale = await env.EPOCHS_CACHE.get(CACHE_KEY);
    if (stale) {
      return new Response(stale, {
        headers: { 'Content-Type': 'application/json', 'X-Cache': 'STALE' },
      });
    }
    return new Response(JSON.stringify({ error: 'Failed to fetch ZKC price' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const change_24h_pct =
    yesterdayPrice !== null && yesterdayPrice > 0
      ? ((todayPrice - yesterdayPrice) / yesterdayPrice) * 100
      : null;

  const payload: ZkcPriceResponse = {
    price: todayPrice,
    change_24h_pct,
    timestamp: now.toISOString(),
  };

  const body = JSON.stringify(payload);
  await env.EPOCHS_CACHE.put(CACHE_KEY, body, { expirationTtl: CACHE_TTL_SECONDS });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': 'MISS',
      'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
    },
  });
};
