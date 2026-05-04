import { useState, useEffect, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Area, AreaChart,
} from 'recharts';
import type { EpochData } from '../../lib/parseEpochs';

interface Props {
  epochs: EpochData[];
  epochsLoading: boolean;
  epochsError: string | null;
}

/** Per-epoch market stats returned by /api/market-stats */
interface MarketStatsBucket {
  epoch: number;
  marketCycles: number;      // total_program_cycles summed over 2 days
  totalCycles: number;        // total_cycles summed over 2 days
  ordersLocked: number;
  ordersFulfilled: number;
  fulfillmentRate: number;   // 0-100
}

/** Merged per-epoch data point for charts */
interface EpochPoint {
  epoch: number;
  povwCyclesT: number;       // PoVW total_work in trillions (from /api/epochs)
  marketCyclesT: number;     // market cycles in trillions (from /api/market-stats)
  pctMarket: number;         // marketCycles / (marketCycles + povwCycles) * 100
  miningRewardsK: number;    // mining rewards in thousands of ZKC
  povwRate: number;           // ZKC per MHz per epoch
}

const fmtCycles = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}P`;
  if (v >= 1) return `${v.toFixed(1)}T`;
  if (v >= 0.001) return `${(v * 1000).toFixed(1)}B`;
  if (v >= 0.000001) return `${(v * 1e6).toFixed(1)}M`;
  return `${(v * 1e9).toFixed(0)}K`;
};

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const T = 1e12;

function mergeEpochData(
  epochs: EpochData[],
  marketStats: MarketStatsBucket[],
): EpochPoint[] {
  const marketByEpoch = new Map<number, MarketStatsBucket>();
  for (const ms of marketStats) {
    marketByEpoch.set(ms.epoch, ms);
  }

  return [...epochs]
    .sort((a, b) => a.epoch - b.epoch)
    .map(e => {
      const povwCycles = e.total_cycles ?? 0;
      const miningRewards = e.mining_rewards_zkc ?? 0;
      const povwRate = povwCycles > 0 ? miningRewards / (povwCycles / 1e6) : 0;
      const ms = marketByEpoch.get(e.epoch);
      const marketCycles = ms?.marketCycles ?? 0;
      const totalAll = povwCycles + marketCycles;
      const pctMarket = totalAll > 0 ? (marketCycles / totalAll) * 100 : 0;

      return {
        epoch: e.epoch,
        povwCyclesT: parseFloat((povwCycles / T).toFixed(2)),
        marketCyclesT: parseFloat((marketCycles / T).toFixed(2)),
        pctMarket: parseFloat(pctMarket.toFixed(2)),
        miningRewardsK: parseFloat((miningRewards / 1000).toFixed(2)),
        povwRate: parseFloat(povwRate.toFixed(5)),
      };
    });
}

export default function PovwCycles({ epochs, epochsLoading, epochsError }: Props) {
  const [marketStats, setMarketStats] = useState<MarketStatsBucket[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const res = await fetch('/api/market-stats');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MarketStatsBucket[] = await res.json();
        setMarketStats(data);
      } catch {
        setStatsError('Market stats unavailable');
      } finally {
        setStatsLoading(false);
      }
    };
    load();
  }, []);

  const loading = epochsLoading || statsLoading;
  const hasData = epochs.length > 0 || marketStats.length > 0;
  const merged = useMemo(() => mergeEpochData(epochs, marketStats), [epochs, marketStats]);
  const latest = merged.length > 0 ? merged[merged.length - 1] : null;

  if (loading && !hasData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⬡</div>
          <p className="text-gray-400">Loading cycle data…</p>
        </div>
      </div>
    );
  }

  const tooltipStyle = {
    contentStyle: { background: '#1f2937', border: '1px solid #374151', borderRadius: 6 },
    labelStyle: { color: '#e5e7eb' },
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-gray-100 text-lg font-semibold mb-1">PoVW &amp; Market Cycles</h2>
        <p className="text-gray-400 text-sm">
          Compares cycles performed on the market versus cycles submitted for PoVW mining.
          {(epochsError || statsError) && (
            <span className="text-yellow-500 ml-2" title={epochsError || statsError || ''}>
              ⚠ {epochsError || statsError}
            </span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {latest && (
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Latest Epoch</p>
            <p className="text-green-400 text-lg font-semibold">
              #{latest.epoch}
            </p>
          </div>
        )}
        {latest && (
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">PoVW Cycles</p>
            <p className="text-cyan-400 text-lg font-semibold">
              {fmtCycles(latest.povwCyclesT)}
            </p>
          </div>
        )}
        {latest && (
          <>
            <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
              <p className="text-gray-500 text-xs mb-1">Market Cycles</p>
              <p className="text-purple-400 text-lg font-semibold">
                {fmtCycles(latest.marketCyclesT)}
              </p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
              <p className="text-gray-500 text-xs mb-1">Total</p>
              <p className="text-cyan-300 text-lg font-semibold">
                {fmtCycles(latest.povwCyclesT + latest.marketCyclesT)}
              </p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
              <p className="text-gray-500 text-xs mb-1">% Market</p>
              <p className="text-amber-400 text-lg font-semibold">
                {latest.pctMarket.toFixed(1)}%
              </p>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* PoVW vs Market Cycles per epoch */}
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">
            Cycles per Epoch — Market vs PoVW
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={merged} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtCycles}
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmtCycles(Number(v)), String(name)]}
                {...tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Area
                type="monotone"
                dataKey="marketCyclesT"
                name="Market Cycles"
                stroke="#a855f7"
                fill="#a855f7"
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="povwCyclesT"
                name="PoVW Cycles"
                stroke="#22d3ee"
                fill="#22d3ee"
                fillOpacity={0.35}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* % Market Cycles over time */}
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">
            % Market Cycles per Epoch
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={merged} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 'auto']}
                tickFormatter={fmtPct}
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={45}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmtPct(Number(v)), String(name)]}
                {...tooltipStyle}
              />
              <Area
                type="monotone"
                dataKey="pctMarket"
                name="% Market"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Epoch-level PoVW Cycles bar chart */}
        {merged.length > 0 && (
          <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
            <h3 className="text-gray-200 text-sm font-semibold mb-3">
              PoVW Cycles per Epoch
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={merged} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtCycles}
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [fmtCycles(Number(v)), String(name)]}
                  {...tooltipStyle}
                />
                <Bar dataKey="povwCyclesT" name="PoVW Cycles" fill="#22d3ee" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* PoVW Reward Rate line chart */}
        {merged.length > 0 && (
          <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
            <h3 className="text-gray-200 text-sm font-semibold mb-3">
              PoVW Reward Rate (ZKC/MHz/epoch)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={merged} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="rate"
                  tickFormatter={(v: number) => v.toFixed(5)}
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                />
                <YAxis
                  yAxisId="rewards"
                  orientation="right"
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [Number(v).toFixed(5), String(name)]}
                  {...tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="povwRate"
                  name="Reward Rate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                />
                <Line
                  yAxisId="rewards"
                  type="monotone"
                  dataKey="miningRewardsK"
                  name="Mining Rewards (K ZKC)"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#22d3ee' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

    </div>
  );
}