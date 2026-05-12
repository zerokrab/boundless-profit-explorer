/**
 * GET /api/provers-history
 *
 * Returns historical unique prover counts mapped to epochs.
 *
 * Data source: https://explorer.boundless.network/base/stats (RSC flight data)
 * Uses the `unique_provers_locking_requests` field from each daily bucket.
 *
 * Strategy:
 *   - Fetches daily stats from the explorer's RSC endpoint
 *   - Groups by epoch_number_start (each epoch spans ~2 days)
 *   - Returns per-epoch unique prover counts
 *   - Cached in KV for 2 hours
 *
 * KV binding: EPOCHS_CACHE
 */

interface Env {
  EPOCHS_CACHE: KVNamespace;
}

/** Raw daily bucket from the explorer's RSC payload. */
interface StatsBucket {
  timestamp: number;
  timestamp_iso: string;
  epoch_number_start: number | null;
  unique_provers_locking_requests: number;
}

/** Per-epoch prover history returned to the frontend. */
interface ProversHistoryBucket {
  epoch: number;
  activeProvers: number;
}

const UPSTREAM = 'https://explorer.boundless.network/base/stats';
const CACHE_KEY = 'provers-history';
const CACHE_TTL_SECONDS = 7200; // 2 hours

/**
 * Extract the JSON array from the RSC flight-data payload.
 * The payload is a mix of React flight instructions and embedded JSON.
 * We grep for the array that starts with {"chain_id": and parse it.
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
  // Handle RSC date references like \"$D2025-12-01T00:00:00.000Z\"
  // by stripping the $D prefix — these appear inside timestamp_iso fields
  const cleaned = jsonStr.replace(/"\$D([^"]+)"/g, '"$1"');

  return JSON.parse(cleaned) as StatsBucket[];
}

/**
 * Group daily buckets by epoch_number_start and sum unique_provers_locking_requests.
 * Since each day has its own count, we take the max (not sum) for each epoch
 * to avoid double-counting the same provers across multiple days.
 */
function groupByEpoch(buckets: StatsBucket[]): ProversHistoryBucket[] {
  // Filter out buckets without an epoch number or with zero provers
  const valid = buckets.filter(
    b => b.epoch_number_start !== null && b.unique_provers_locking_requests > 0
  );

  // Group by epoch — take the max unique provers across days in each epoch
  const grouped = new Map<number, number>();

  for (const b of valid) {
    const epoch = b.epoch_number_start!;
    const existing = grouped.get(epoch);
    if (existing === undefined || b.unique_provers_locking_requests > existing) {
      grouped.set(epoch, b.unique_provers_locking_requests);
    }
  }

  // Sort by epoch ascending and exclude the latest (in-progress) epoch
  const epochs = [...grouped.entries()]
    .sort((a, b) => a[0] - b[0]);

  // The last epoch may still be in-progress — exclude it
  const completed = epochs.slice(0, -1);

  return completed.map(([epoch, provers]) => ({
    epoch,
    activeProvers: provers,
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
    return new Response(JSON.stringify({ error: 'Failed to fetch prover history', detail: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
