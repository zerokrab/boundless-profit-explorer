import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { computeZkcPrices } from '../../lib/compute';
import type { ModelParams, ScenarioResult } from '../../lib/compute';

interface Props {
  results: ScenarioResult[];
  params: ModelParams;
  liveZkcPrice: number | null;
}

const fmtUsd = (v: number) => `$${v.toFixed(2)}`;
const fmtUsdShort = (v: number) => {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
};

export default function ProfitExplorer({ results, params, liveZkcPrice }: Props) {
  const prices = useMemo(() => computeZkcPrices(params.zkc_price_min, params.zkc_price_max, params.zkc_price_steps), [params]);
  const [priceIdx, setPriceIdx] = useState(0);
  const selectedPrice = prices[priceIdx] ?? params.zkc_price_min;

  // Filter results at selected price (closest match)
  const atPrice = useMemo(() => {
    const byScenario: Record<string, ScenarioResult> = {};
    for (const r of results) {
      if (Math.abs(r.zkc_price_usd - selectedPrice) < 1e-9) {
        byScenario[r.scenario] = r;
      }
    }
    // fallback: pick closest
    if (Object.keys(byScenario).length === 0) {
      const scenarios = [...new Set(results.map(r => r.scenario))];
      for (const s of scenarios) {
        const rows = results.filter(r => r.scenario === s);
        rows.sort((a, b) => Math.abs(a.zkc_price_usd - selectedPrice) - Math.abs(b.zkc_price_usd - selectedPrice));
        if (rows[0]) byScenario[s] = rows[0];
      }
    }
    return Object.values(byScenario);
  }, [results, selectedPrice]);

  const profitData = atPrice.map(r => ({
    name: r.scenario,
    profit: parseFloat(r.profit_per_epoch.toFixed(2)),
  }));

  const breakdownData = atPrice.map(r => ({
    name: r.scenario,
    povw: parseFloat(r.povw_revenue.toFixed(2)),
    market: parseFloat(r.market_revenue.toFixed(2)),
    cost: parseFloat((-r.cost_per_epoch).toFixed(2)),
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-gray-100 text-lg font-semibold mb-1">Profit Explorer</h2>
        <p className="text-gray-400 text-sm">Profit per epoch across GPU configurations at a given ZKC price.</p>
      </div>

      {/* ZKC Price Slider */}
      <div className="bg-[#111827] rounded-lg p-4 mb-6 border border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-sm">ZKC Price</span>
          <span className="text-cyan-400 font-mono text-lg font-semibold">${selectedPrice.toFixed(4)}</span>
        </div>
        {/* Slider with optional live-price marker */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={prices.length - 1}
            step={1}
            value={priceIdx}
            onChange={e => setPriceIdx(Number(e.target.value))}
            className="w-full accent-cyan-500"
          />
          {(() => {
            if (liveZkcPrice === null) return null;
            const inRange = liveZkcPrice >= params.zkc_price_min && liveZkcPrice <= params.zkc_price_max;
            if (!inRange) return null;
            const pct = (liveZkcPrice - params.zkc_price_min) / (params.zkc_price_max - params.zkc_price_min) * 100;
            return (
              <div
                className="absolute top-full mt-0.5 flex flex-col items-center pointer-events-none"
                style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-px h-1.5 bg-amber-400" />
                <span className="text-amber-400 font-mono whitespace-nowrap" style={{ fontSize: '10px' }}>
                  ${liveZkcPrice.toFixed(4)}
                </span>
              </div>
            );
          })()}
        </div>
        <div className="flex justify-between text-gray-600 text-xs mt-5">
          <span>${params.zkc_price_min.toFixed(3)}</span>
          <span>${params.zkc_price_max.toFixed(3)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Profit per Epoch */}
        <div className="bg-[#111827] rounded-lg p-4 border border-gray-800">
          <h3 className="text-gray-300 text-sm font-semibold mb-4">Profit per Epoch (USD)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={profitData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtUsdShort}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                formatter={(v: unknown) => [fmtUsd(Number(v)), 'Profit']}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <ReferenceLine x={0} stroke="#4b5563" />
              <Bar dataKey="profit" radius={[0, 4, 4, 0]}>
                {profitData.map((entry, i) => (
                  <Cell key={i} fill={entry.profit >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue / Cost Breakdown */}
        <div className="bg-[#111827] rounded-lg p-4 border border-gray-800">
          <h3 className="text-gray-300 text-sm font-semibold mb-2">Revenue & Cost Breakdown</h3>
          <div className="flex gap-3 mb-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#3b82f6' }}></span><span className="text-gray-400">POVW</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#8b5cf6' }}></span><span className="text-gray-400">Market</span></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#f97316' }}></span><span className="text-gray-400">Cost (neg)</span></span>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={breakdownData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={fmtUsdShort}
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#9ca3af', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmtUsd(Number(v)), String(name).toUpperCase()]}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <ReferenceLine x={0} stroke="#4b5563" />
              <Bar dataKey="povw" name="povw" fill="#3b82f6" stackId="a" />
              <Bar dataKey="market" name="market" fill="#8b5cf6" stackId="a" />
              <Bar dataKey="cost" name="cost" fill="#f97316" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
