/**
 * GET /api/provers-history
 *
 * Returns historical active prover counts mapped to epochs.
 *
 * Strategy:
 *   - Every invocation fetches the current prover count from the upstream API
 *     and appends/updates a daily snapshot in KV (key: "provers-history-daily").
 *   - Daily snapshots are permanent (no TTL) — historical data is immutable,
 *     only today's snapshot gets updated.
 *   - The final per-epoch result is cached for 2 hours in KV
 *     (key: "provers-history").
 *   - When upstream is unavailable, gracefully degrades to stale cached data.
 *
 * Epoch mapping:
 *   Each epoch spans ~2 days. We average the daily prover counts that fall
 *   within each epoch's time window. Epoch timestamps come from the cached
 *   epochs data.
 *
 * KV binding: EPOCHS_CACHE
 */

interface Env {
  EPOCHS_CACHE: KVNamespace;
}

interface ProversHistoryBucket {
  epoch: number;
  activeProvers: number;
}

/** Daily snapshot stored in KV */
interface DailySnapshot {
  date: string; // YYYY-MM-DD
  active_provers: number;
}

interface EpochData {
  epoch: number;
  timestamp: string;
}

const UPSTREAM = 'https://explorer.boundless.network/api/base/provers/summary/1d';
const RESULT_CACHE_KEY = 'provers-history';
const DAILY_SNAPSHOTS_KEY = 'provers-history-daily';
const EPOCHS_CACHE_KEY = 'epochs';
const RESULT_CACHE_TTL = 7200; // 2 hours

function toDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  // 1. Try to fetch current prover count and update daily snapshot
  let currentCount: number | null = null;
  try {
    const upstream = await fetch(UPSTREAM);
    if (upstream.ok) {
      const provers = await upstream.json<unknown[]>();
      currentCount = provers.length;
    }
  } catch {
    // Upstream unavailable — we'll still try to serve from history
  }

  // 2. Update daily snapshots in KV
  if (currentCount !== null) {
    const todayKey = toDateKey(new Date().toISOString());
    const historyRaw = await env.EPOCHS_CACHE.get(DAILY_SNAPSHOTS_KEY);
    const snapshots: DailySnapshot[] = historyRaw ? JSON.parse(historyRaw) : [];

    const existingIdx = snapshots.findIndex(s => s.date === todayKey);
    if (existingIdx >= 0) {
      snapshots[existingIdx].active_provers = currentCount;
    } else {
      snapshots.push({ date: todayKey, active_provers: currentCount });
    }

    // Sort by date ascending, save (no TTL — historical snapshots are permanent)
    snapshots.sort((a, b) => a.date.localeCompare(b.date));
    await env.EPOCHS_CACHE.put(DAILY_SNAPSHOTS_KEY, JSON.stringify(snapshots));
  }

  // 3. Try to return the cached result (2h TTL) if upstream was successful
  //    (we just updated snapshots, so a fresh result will be computed in MISS path)
  if (currentCount !== null) {
    const cached = await env.EPOCHS_CACHE.get(RESULT_CACHE_KEY);
    if (cached) {
      // Verify the cached result isn't stale by re-computing
      // Actually, simpler: just serve cached if available on MISS path below
    }
  }

  // 4. Compute per-epoch prover history from daily snapshots
  const historyRaw = await env.EPOCHS_CACHE.get(DAILY_SNAPSHOTS_KEY);
  const snapshots: DailySnapshot[] = historyRaw ? JSON.parse(historyRaw) : [];

  if (snapshots.length === 0 && currentCount === null) {
    // No data at all — return empty array
    return new Response('[]', {
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Load epoch timestamps from KV cache
  const epochsRaw = await env.EPOCHS_CACHE.get(EPOCHS_CACHE_KEY);
  const epochs: EpochData[] = epochsRaw ? JSON.parse(epochsRaw) : [];

  // Map epochs to prover counts
  // Each epoch spans ~2 days starting at epoch.timestamp
  const result: ProversHistoryBucket[] = [];

  for (const epoch of epochs) {
    const epochStartDate = toDateKey(epoch.timestamp);
    // Epoch is ~2 days
    const epochStart = new Date(epoch.timestamp);
    const epochEnd = new Date(epochStart.getTime() + 2 * 24 * 60 * 60 * 1000);
    const epochEndDate = toDateKey(epochEnd.toISOString());

    // Find daily snapshots within this epoch's window
    const epochSnapshots = snapshots.filter(
      s => s.date >= epochStartDate && s.date <= epochEndDate
    );

    if (epochSnapshots.length > 0) {
      const avgProvers =
        epochSnapshots.reduce((sum, s) => sum + s.active_provers, 0) /
        epochSnapshots.length;
      result.push({
        epoch: epoch.epoch,
        activeProvers: parseFloat(avgProvers.toFixed(1)),
      });
    }
  }

  const body = JSON.stringify(result);

  // Cache the result for 2 hours
  await env.EPOCHS_CACHE.put(RESULT_CACHE_KEY, body, {
    expirationTtl: RESULT_CACHE_TTL,
  });

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Cache': currentCount !== null ? 'MISS' : 'STALE',
      'Cache-Control': `public, max-age=${RESULT_CACHE_TTL}`,
    },
  });
};