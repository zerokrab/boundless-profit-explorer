import { useState, useEffect, useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Area, AreaChart, LineChart, Line,
} from 'recharts';
import type { EpochData } from '../../lib/parseEpochs';
import TooltipIcon from '../TooltipIcon';

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: 8,
    color: '#e5e7eb',
    fontSize: 12,
  },
  itemStyle: { color: '#e5e7eb' },
  labelStyle: { color: '#9ca3af', fontWeight: 600 },
};

/* ---------- helpers ---------- */
function fmtK(v: number): string { return v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0); }
function fmtCycles(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(0);
}

interface MergedRow {
  epoch: number;
  marketCyclesT: number;
  povwCyclesT: number;
  pctMarket: number;
  miningRewardsK: number;
  povwRate: number;           // ZKC per MHz per epoch
  povwRateUSD: number;        // USD per MHz per epoch (povwRate * zkc_price_usd)
  grindingRewardsZKC: number; // mining_rewards * (1 - pctMarket/100) in K ZKC
  grindingRewardsUSD: number; // grindingRewardsZKC * zkc_price_usd
  minerCount: number;         // num_participants from /api/epochs
  activeProvers: number;      // averaged daily provers from /api/provers-history
}

interface StatsProps {
  epochs: EpochData[];
  epochsLoading: boolean;
  epochsError: string | null;
}

export default function Stats({ epochs, epochsLoading, epochsError }: StatsProps) {
  const [proversHistory, setProversHistory] = useState<{ epoch: number; provers: number }[]>([]);

  useEffect(() => {
    fetch('/api/provers-history')
      .then(r => r.json())
      .then(setProversHistory)
      .catch(() => setProversHistory([]));
  }, []);

  const merged = useMemo<MergedRow[]>(() => {
    const pMap = new Map(proversHistory.map(p => [p.epoch, p.provers]));
    return epochs.map(e => {
      const zkc = e.zkc_price_usd ?? 0;
      const totalCycles = e.total_cycles ?? 0;
      const mkt = e.market_cycles ?? 0;
      const miningRewards = e.mining_rewards_zkc ?? 0;
      const grindingRewards = miningRewards * (1 - (e.pct_market ?? 0) / 100);
      const total = mkt + totalCycles;
      return {
        epoch: e.epoch,
        marketCyclesT: mkt / 1e12,
        povwCyclesT: total / 1e12,
        pctMarket: total > 0 ? (mkt / total) * 100 : 0,
        miningRewardsK: miningRewards / 1000,
        povwRate: total > 0 ? (miningRewards / (total / 1e6)) : 0,
        povwRateUSD: total > 0 ? (miningRewards / (total / 1e6)) * zkc : 0,
        grindingRewardsZKC: grindingRewards / 1000,
        grindingRewardsUSD: (grindingRewards * zkc) / 1000,
        minerCount: e.num_participants ?? 0,
        activeProvers: pMap.get(e.epoch) ?? 0,
      };
    });
  }, [epochs, proversHistory]);

  const stats = useMemo(() => {
    if (!merged.length) return null;
    const avgPct = merged.reduce((s, r) => s + r.pctMarket, 0) / merged.length;
    const avgRate = merged.reduce((s, r) => s + r.povwRate, 0) / merged.length;
    const avgRateUSD = merged.reduce((s, r) => s + r.povwRateUSD, 0) / merged.length;
    const latest = merged[merged.length - 1];
    return { avgPct, avgRate, avgRateUSD, latest };
  }, [merged]);

  if (epochsLoading) return <p className="text-gray-400">Loading stats…</p>;
  if (epochsError)   return <p className="text-red-400">{epochsError}</p>;
  if (!merged.length) return null;

  /* ---------- render ---------- */
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">PoVW Cycles</p>
            <p className="text-lg font-semibold text-white">{fmtCycles(stats.latest.povwCyclesT * 1e12)} <span className="text-xs text-gray-400">cycles</span></p>
          </div>
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Market Cycles</p>
            <p className="text-lg font-semibold text-white">{fmtCycles(stats.latest.marketCyclesT * 1e12)} <span className="text-xs text-gray-400">cycles</span></p>
          </div>
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Average % Market Cycles<TipIcon text="Percent of PoVW cycles that are from market orders, averaged across all epochs." /></p>
            <p className="text-lg font-semibold text-white">{stats.avgPct.toFixed(2)}%</p>
          </div>
          <div className="bg-[#111827] rounded-lg p-3 border border-gray-800">
            <p className="text-gray-500 text-xs mb-1">Avg PoVW Rate<TipIcon text="Average reward rate per million PoVW cycles across all epochs" /></p>
            <p className="text-lg font-semibold text-white">{stats.avgRate.toFixed(5)} ZKC <span className="text-xs text-gray-400">/Mil. Cycles</span></p>
          </div>
        </div>
      )}

      {/* PoVW vs Market Cycles per epoch */}
      <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
        <h3 className="text-gray-200 text-sm font-semibold mb-3">
          PoVW Cycle Composition
          <TooltipIcon text="Shows the portion of PoVW cycles that were from market orders" />
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
              formatter={(v: unknown, name: unknown) => [fmtCycles(Number(v) * 1e12), String(name)]}
              labelFormatter={(label) => `Epoch ${label}`}
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
          <TooltipIcon text="Percent of total PoVW cycles that were from market orders" />
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
              domain={[0, 100]}
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, '% Market']}
              labelFormatter={(label) => `Epoch ${label}`}
              {...tooltipStyle}
            />
            <Area
              type="monotone"
              dataKey="pctMarket"
              stroke="#a855f7"
              fill="#a855f7"
              fillOpacity={0.35}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Non-Market PoVW Rewards chart */}
      {merged.length > 0 && (
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">
            Total Non-Market PoVW Rewards Per Epoch
            <TooltipIcon text="Value of rewards paid for cycles that were not from market orders" />
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={merged} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                yAxisId="zkc"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={55}
                label={{ value: 'ZKC', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
                tickFormatter={(v: number) => `${v.toFixed(0)}K`}
              />
              <YAxis
                yAxisId="usd"
                orientation="right"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={60}
                label={{ value: 'USD', angle: 90, position: 'insideRight', style: { fill: '#9ca3af', fontSize: 10 } }}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => {
                  const n = Number(v);
                  if (String(name) === 'USD') return [`$${n.toFixed(2)}`, name];
                  return [`${n.toFixed(2)}K ZKC`, name];
                }}
                labelFormatter={(label) => `Epoch ${label}`}
                {...tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              <Area
                yAxisId="zkc"
                type="monotone"
                dataKey="grindingRewardsZKC"
                name="ZKC"
                stroke="#22d3ee"
                fill="#22d3ee"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Area
                yAxisId="usd"
                type="monotone"
                dataKey="grindingRewardsUSD"
                name="USD"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* PoVW Reward Rate chart */}
      <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
        <h3 className="text-gray-200 text-sm font-semibold mb-3">
          PoVW Reward Rate
          <TooltipIcon text="Amount paid per million cycles" />
        </h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={merged} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="epoch"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
            />
            <YAxis
              yAxisId="zkc"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={60}
              label={{ value: 'ZKC/Mil. Cycles', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af', fontSize: 10 } }}
              tickFormatter={(v) => v.toFixed(5)}
            />
            <YAxis
              yAxisId="usd"
              orientation="right"
              tick={{ fill: '#9ca3af', fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={60}
              label={{ value: 'USD/Mil. Cycles', angle: 90, position: 'insideRight', style: { fill: '#9ca3af', fontSize: 10 } }}
              tickFormatter={(v) => `$${v.toFixed(5)}`}
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => {
                const n = Number(v);
                if (String(name).includes('USD')) return [`$${n.toFixed(5)}/Mil. Cycles`, String(name)];
                return [`${n.toFixed(5)} ZKC/Mil. Cycles`, String(name)];
              }}
              labelFormatter={(label) => `Epoch ${label}`}
              {...tooltipStyle}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
            <Area
              yAxisId="zkc"
              type="monotone"
              dataKey="povwRate"
              name="ZKC/Mil. Cycles"
              stroke="#22d3ee"
              fill="#22d3ee"
              fillOpacity={0.25}
              strokeWidth={2}
            />
            <Area
              yAxisId="usd"
              type="monotone"
              dataKey="povwRateUSD"
              name="USD/Mil. Cycles"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Miners & Provers count */}
      {merged.some(e => e.minerCount > 0 || e.activeProvers > 0) && (
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">
            Miners &amp; Provers per Epoch
            <TooltipIcon text="Number of unique miners (PoVW) and provers (market) per epoch" />
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
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [Number(v), String(name)]}
                labelFormatter={(label) => `Epoch ${label}`}
                {...tooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
              {merged.some(e => e.minerCount > 0) && (
                <Line
                  type="monotone"
                  dataKey="minerCount"
                  name="Miners"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {merged.some(e => e.activeProvers > 0) && (
                <Line
                  type="monotone"
                  dataKey="activeProvers"
                  name="Provers"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}