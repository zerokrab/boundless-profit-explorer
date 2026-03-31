import { useState, useEffect, useCallback } from 'react';

interface ZkcPrice {
  price: number;
  change_24h_pct: number | null;
  timestamp: string;
}

interface Props {
  onPriceLoad?: (price: number) => void;
}

const POLL_INTERVAL_MS = 60_000; // 60 seconds

export default function ZkcTicker({ onPriceLoad }: Props) {
  const [data, setData] = useState<ZkcPrice | null>(null);
  const [status, setStatus] = useState<'loading' | 'live' | 'stale'>('loading');

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch('/api/zkc-price');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ZkcPrice = await res.json();
      setData(json);
      setStatus('live');
      onPriceLoad?.(json.price);
    } catch {
      // Keep showing last known price but mark stale
      setStatus(prev => prev === 'loading' ? 'stale' : 'stale');
    }
  }, [onPriceLoad]);

  // Initial fetch + polling
  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  // Refetch on tab focus
  useEffect(() => {
    const onFocus = () => fetchPrice();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchPrice]);

  const change = data?.change_24h_pct;
  const changePositive = change !== null && change !== undefined && change >= 0;
  const changeColor = change === null || change === undefined
    ? 'text-gray-500'
    : changePositive ? 'text-green-400' : 'text-red-400';
  const changeArrow = change === null || change === undefined
    ? ''
    : changePositive ? '▲' : '▼';

  return (
    <div className="flex items-center gap-2 text-sm font-mono">
      {/* Live status dot */}
      <span className="relative flex h-2 w-2">
        {status === 'live' ? (
          <>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
          </>
        ) : status === 'stale' ? (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500" />
        ) : (
          <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-600 animate-pulse" />
        )}
      </span>

      <span className="text-gray-400 text-xs font-sans">ZKC</span>

      {status === 'loading' && !data ? (
        <span className="text-gray-600 animate-pulse">—</span>
      ) : data ? (
        <>
          <span className="text-gray-100 font-semibold">
            ${data.price.toFixed(4)}
          </span>
          {change !== null && change !== undefined && (
            <span className={`text-xs ${changeColor}`}>
              {changeArrow}{Math.abs(change).toFixed(1)}%
            </span>
          )}
        </>
      ) : (
        <span className="text-yellow-500 text-xs">unavailable</span>
      )}
    </div>
  );
}
