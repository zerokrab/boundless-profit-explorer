/**
 * GET /api/provers-count
 *
 * Fetches the number of active provers on the Boundless market from
 * https://explorer.boundless.network/api/base/provers/summary/1d
 * and caches the result in KV for 2 hours.
 *
 * Returns a simple JSON object: { "active_provers": <number> }
 *
 * KV binding: EPOCHS_CACHE (key: "provers-count")
 *
 * Response headers:
 *   X-Cache: HIT | MISS | STALE
 *   Cache-Control: public, max-age=7200
 */

interface Env {
  EPOCHS_CACHE: KVNamespace;
}

const UPSTREAM = 'https://explorer.boundless.network/api/base/provers/summary/1d';
const CACHE_KEY = 'provers-count';
const CACHE_TTL_SECONDS = 7200; // 2 hours

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
    const provers = await upstream.json<unknown[]>();
    const active_provers = provers.length;

    const body = JSON.stringify({ active_provers });

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
    return new Response(
      JSON.stringify({ error: 'Failed to fetch prover count', detail: message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};