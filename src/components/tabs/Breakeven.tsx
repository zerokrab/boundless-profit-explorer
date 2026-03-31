import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';
import { computeBreakeven } from '../../lib/compute';
import type { ModelParams } from '../../lib/compute';

interface Props {
  params: ModelParams;
  liveZkcPrice: number | null;
}

const fmtUsd = (v: number) => `$${v.toFixed(4)}`;
const fmtUsdShort = (v: number) => `$${v.toFixed(2)}`;

function breakColor(v: number | null): string {
  if (v === null) return '#ef4444';
  if (v < 0.10) return '#22c55e';
  if (v <= 0.50) return '#eab308';
  return '#ef4444';
}

export default function Breakeven({ params, liveZkcPrice }: Props) {
  const breakevenData = computeBreakeven(params);

  const chartData = breakevenData.map(b => ({
    name: b.scenario,
    breakeven: b.breakeven_zkc !== null ? parseFloat(b.breakeven_zkc.toFixed(4)) : null,
    unreachable: b.breakeven_zkc === null ? 2.0 : null,
  }));

  const currentZkcPrice = params.zkc_price_min;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-gray-100 text-lg font-semibold mb-1">Break-even Analysis</h2>
        <p className="text-gray-400 text-sm">Minimum ZKC price required to break even per GPU configuration.</p>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-green-500"></span>
          <span className="text-gray-400">&lt; $0.10 (favorable)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-yellow-500"></span>
          <span className="text-gray-400">$0.10–$0.50 (moderate)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-red-500"></span>
          <span className="text-gray-400">&gt; $0.50 or unreachable</span>
        </span>
      </div>

      <div className="bg-[#111827] rounded-lg p-4 border border-gray-800">
        <h3 className="text-gray-300 text-sm font-semibold mb-4">Minimum ZKC Price to Break Even</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 80, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={fmtUsdShort}
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              axisLine={{ stroke: '#374151' }}
              tickLine={false}
              domain={[0, 'auto']}
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
              formatter={(v: unknown, name: unknown) => {
                if (name === 'unreachable' || v === null || v === undefined) return ['Unreachable', 'Break-even'];
                return [fmtUsd(Number(v)), 'Break-even ZKC'];
              }}
              contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
              labelStyle={{ color: '#e5e7eb' }}
            />
            {/* Reference lines */}
            <ReferenceLine x={0.10} stroke="#22c55e" strokeDasharray="4 3" label={{ value: '$0.10', fill: '#22c55e', fontSize: 10, position: 'top' }} />
            <ReferenceLine x={0.50} stroke="#eab308" strokeDasharray="4 3" label={{ value: '$0.50', fill: '#eab308', fontSize: 10, position: 'top' }} />
            <ReferenceLine x={currentZkcPrice} stroke="#22d3ee" strokeDasharray="3 3" label={{ value: `Current $${currentZkcPrice.toFixed(3)}`, fill: '#22d3ee', fontSize: 10, position: 'top' }} />
            {liveZkcPrice !== null && (
              <ReferenceLine x={liveZkcPrice} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: `Live $${liveZkcPrice.toFixed(4)}`, fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
            )}
            <Bar dataKey="breakeven" name="breakeven" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={breakColor(entry.breakeven)} />
              ))}
            </Bar>
            <Bar dataKey="unreachable" name="unreachable" fill="#ef4444" radius={[0, 4, 4, 0]} opacity={0.4} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="mt-6 bg-[#111827] rounded-lg p-4 border border-gray-800">
        <h3 className="text-gray-300 text-sm font-semibold mb-3">Summary</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left pb-2 font-medium">Configuration</th>
              <th className="text-right pb-2 font-medium">Break-even ZKC</th>
              <th className="text-right pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {breakevenData.map(b => (
              <tr key={b.scenario} className="border-b border-gray-800">
                <td className="py-2 text-gray-200">{b.scenario}</td>
                <td className="py-2 text-right font-mono" style={{ color: breakColor(b.breakeven_zkc) }}>
                  {b.breakeven_zkc !== null ? fmtUsd(b.breakeven_zkc) : '—'}
                </td>
                <td className="py-2 text-right text-xs">
                  {b.breakeven_zkc === null ? (
                    <span className="text-red-400">Unreachable</span>
                  ) : b.breakeven_zkc < 0.10 ? (
                    <span className="text-green-400">Favorable</span>
                  ) : b.breakeven_zkc <= 0.50 ? (
                    <span className="text-yellow-400">Moderate</span>
                  ) : (
                    <span className="text-red-400">Challenging</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
