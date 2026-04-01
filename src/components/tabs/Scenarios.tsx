import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import type { ScenarioResult } from '../../lib/compute';

interface Props {
  results: ScenarioResult[];
  liveZkcPrice: number | null;
}

const fmtUsd = (v: number) => `$${v.toFixed(2)}`;
const fmtUsdX = (v: number) => `$${v.toFixed(3)}`;

export default function Scenarios({ results, liveZkcPrice }: Props) {
  const scenarios = [...new Set(results.map(r => r.scenario))];

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-gray-100 text-lg font-semibold mb-1">Profit Scenarios</h2>
        <p className="text-gray-400 text-sm">Profit per epoch vs ZKC price for each GPU configuration.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {scenarios.map(scenario => {
          const data = results
            .filter(r => r.scenario === scenario)
            .sort((a, b) => a.zkc_price_usd - b.zkc_price_usd)
            .map(r => ({
              price: parseFloat(r.zkc_price_usd.toFixed(4)),
              profit: parseFloat(r.profit_per_epoch.toFixed(2)),
              povw: parseFloat(r.povw_revenue.toFixed(2)),
              market: parseFloat(r.market_revenue.toFixed(2)),
              cost: parseFloat(r.cost_per_epoch.toFixed(2)),
            }));

          const maxProfit = Math.max(...data.map(d => d.profit));
          const minProfit = Math.min(...data.map(d => d.profit));
          const isEverProfitable = maxProfit >= 0;

          return (
            <div key={scenario} className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
              <div className="flex items-start sm:items-center justify-between mb-3 gap-2">
                <h3 className="text-gray-200 text-sm font-semibold">{scenario}</h3>
                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                  {isEverProfitable ? (
                    <span className="text-green-400 bg-green-900/30 px-2 py-0.5 rounded">Profitable range exists</span>
                  ) : (
                    <span className="text-red-400 bg-red-900/30 px-2 py-0.5 rounded">Never profitable</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-gray-500 mb-3 font-mono">
                Range: {fmtUsd(minProfit)} → {fmtUsd(maxProfit)} per epoch
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis
                    dataKey="price"
                    tickFormatter={fmtUsdX}
                    tick={{ fill: '#9ca3af', fontSize: 9 }}
                    axisLine={{ stroke: '#374151' }}
                    tickLine={false}
                    label={{ value: 'ZKC Price (USD)', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 10 }}
                  />
                  <YAxis
                    tickFormatter={fmtUsd}
                    tick={{ fill: '#9ca3af', fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                  />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [fmtUsd(Number(v)), String(name)]}
                    labelFormatter={(l: unknown) => `ZKC Price: $${Number(l).toFixed(4)}`}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <ReferenceLine y={0} stroke="#4b5563" strokeDasharray="4 3" />
                  {liveZkcPrice !== null && (
                    <ReferenceLine
                      x={parseFloat(liveZkcPrice.toFixed(4))}
                      stroke="#f59e0b"
                      strokeDasharray="4 3"
                      label={{ value: 'Live', position: 'top', fill: '#f59e0b', fontSize: 9 }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Profit"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#22d3ee' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </div>
  );
}
