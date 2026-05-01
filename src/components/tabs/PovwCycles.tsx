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

/** Shape returned by /api/market-stats */
interface MarketStatsBucket {
  date: string;
  totalCycles: number;
  povwCycles: number;
  marketCycles: number;
  pctMarket: number;
  ordersLocked: number;
  ordersFulfilled: number;
  fulfillmentRate: number;
}

/** Daily chart data point for the area charts */
interface DailyPoint {
  date: string;
  dateShort: string;     // MM-DD
  povwCyclesT: number;   // PoVW mining cycles in trillions
  marketCyclesT: number; // open market cycles in trillions
  totalCyclesT: number;  // total cycles in trillions
  pctMarket: number;
  fulfillmentRate: number;
}

/** Epoch chart data point */
interface EpochPoint {
  epoch: number;
  povwCyclesB: number;   // PoVW total_work in billions
  miningRewardsK: number; // mining rewards in thousands of ZKC
  povwRate: number;       // ZKC per MHz per epoch
}

const fmtTrillions = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}P`;
  if (v >= 1) return `${v.toFixed(1)}T`;
  if (v >= 0.001) return `${(v * 1000).toFixed(1)}B`;
  return `${(v * 1e6).toFixed(0)}M`;
};

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

function toDailyPoints(stats: MarketStatsBucket[]): DailyPoint[] {
  const T = 1e12;
  return stats.map(b => {
    const totalCycles = b.totalCycles ?? 0;
    const marketCycles = b.marketCycles ?? 0;
    const povwCycles = b.povwCycles ?? (totalCycles - marketCycles);
    const pctMarket = b.pctMarket ?? (totalCycles > 0 ? (marketCycles / totalCycles) * 100 : 0);
    return {
      date: b.date,
      dateShort: b.date.slice(5),
      povwCyclesT: parseFloat((povwCycles / T).toFixed(2)),
      marketCyclesT: parseFloat((marketCycles / T).toFixed(2)),
      totalCyclesT: parseFloat((totalCycles / T).toFixed(2)),
      pctMarket: parseFloat(pctMarket.toFixed(2)),
      fulfillmentRate: b.fulfillmentRate ?? 0,
    };
  });
}

function toEpochPoints(epochs: EpochData[]): EpochPoint[] {
  return [...epochs]
    .sort((a, b) => a.epoch - b.epoch)
    .map(e => {
      const totalWork = e.total_cycles ?? 0;
      const miningRewards = e.mining_rewards_zkc ?? 0;
      const povwRate = totalWork > 0 ? miningRewards / (totalWork / 1e6) : 0;
      return {
        epoch: e.epoch,
        povwCyclesB: parseFloat((totalWork / 1e9).toFixed(2)),
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
  const dailyData = useMemo(() => toDailyPoints(marketStats), [marketStats]);
  const epochData = useMemo(() => toEpochPoints(epochs), [epochs]);
  const latest = marketStats.length > 0 ? marketStats[marketStats.length - 1] : null;

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
          Cycles on the Boundless network — PoVW mining vs open market orders.
          {(epochsError || statsError) && (
            <span className="text-yellow-500 ml-2" title={epochsError || statsError || ''}>
              ⚠ {epochsError || statsError}
            </span>
          )}
        </p>
      </div>

      {/* Summary cards */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Total Cycles (latest day)</p>
            <p className="text-cyan-300 text-lg font-semibold">
              {fmtTrillions((latest.totalCycles ?? 0) / 1e12)}
            </p>
          </div>
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">PoVW Cycles</p>
            <p className="text-cyan-400 text-lg font-semibold">
              {fmtTrillions(((latest.povwCycles ?? (latest.totalCycles ?? 0) - (latest.marketCycles ?? 0)) / 1e12))}
            </p>
          </div>
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Market Cycles</p>
            <p className="text-purple-400 text-lg font-semibold">
              {fmtTrillions((latest.marketCycles ?? 0) / 1e12)}
            </p>
          </div>
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">% Market Cycles</p>
            <p className="text-amber-400 text-lg font-semibold">
              {(latest.pctMarket ?? (latest.totalCycles ? (latest.marketCycles ?? 0) / latest.totalCycles * 100 : 0)).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Daily Total Cycles — PoVW vs Market stacked area chart */}
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">
            Daily Cycles — PoVW vs Market
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="dateShort"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtTrillions}
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={55}
                label={{ value: 'Cycles', angle: -90, position: 'insideLeft', offset: 30, fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmtTrillions(Number(v)), String(name)]}
                {...tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Area
                type="monotone"
                dataKey="povwCyclesT"
                name="PoVW Cycles"
                stackId="1"
                stroke="#22d3ee"
                fill="#22d3ee"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="marketCyclesT"
                name="Market Cycles"
                stackId="1"
                stroke="#a855f7"
                fill="#a855f7"
                fillOpacity={0.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* % Market Cycles over time */}
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">
            % Market Cycles (Daily)
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyData} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="dateShort"
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
                width={50}
                label={{ value: '%', angle: -90, position: 'insideLeft', offset: 25, fill: '#9ca3af', fontSize: 10 }}
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
        {epochData.length > 0 && (
          <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
            <h3 className="text-gray-200 text-sm font-semibold mb-3">
              PoVW Cycles per Epoch
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={epochData} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  label={{ value: 'Epoch', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v.toFixed(0)}B`}
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                  label={{ value: 'Cycles (B)', angle: -90, position: 'insideLeft', offset: 30, fill: '#9ca3af', fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}B`, String(name)]}
                  {...tooltipStyle}
                />
                <Bar dataKey="povwCyclesB" name="PoVW Cycles" fill="#22d3ee" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* PoVW Reward Rate line chart */}
        {epochData.length > 0 && (
          <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
            <h3 className="text-gray-200 text-sm font-semibold mb-3">
              PoVW Reward Rate (ZKC/MHz/epoch)
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={epochData} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="epoch"
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  label={{ value: 'Epoch', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 10 }}
                />
                <YAxis
                  tickFormatter={(v: number) => v.toFixed(5)}
                  tick={{ fill: '#9ca3af', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                  label={{ value: 'ZKC/MHz', angle: -90, position: 'insideLeft', offset: 40, fill: '#9ca3af', fontSize: 10 }}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [Number(v).toFixed(5), String(name)]}
                  {...tooltipStyle}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                <Line
                  type="monotone"
                  dataKey="povwRate"
                  name="Reward Rate"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                />
                <Line
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

      {/* Data source footnote */}
      <p className="text-gray-600 text-xs mt-4">
        Market data: Boundless Explorer · PoVW: /api/epochs · Stats: /api/market-stats
      </p>
    </div>
  );
}