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

function breakColor(v: number | null, liveZkcPrice: number | null): string {
  if (v === null) return '#ef4444';
  if (liveZkcPrice !== null) return v <= liveZkcPrice ? '#22c55e' : '#ef4444';
  // fallback when live price not loaded: green if reachable, red if not
  return '#22c55e';
}

export default function Breakeven({ params, liveZkcPrice }: Props) {
  const breakevenData = computeBreakeven(params);

  const chartData = breakevenData.map(b => ({
    name: b.scenario,
    breakeven: b.breakeven_zkc !== null ? parseFloat(b.breakeven_zkc.toFixed(4)) : null,
    unreachable: b.breakeven_zkc === null ? 2.0 : null,
  }));

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
          <span className="text-gray-400">Profitable</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-red-500"></span>
          <span className="text-gray-400">Not profitable</span>
        </span>
        {liveZkcPrice !== null && (
          <span className="flex items-center gap-1.5">
            <svg width="18" height="12"><line x1="0" y1="6" x2="18" y2="6" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3"/></svg>
            <span className="text-gray-400">Current price</span>
          </span>
        )}
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
              itemStyle={{ color: '#e5e7eb' }}
            />
            {/* Reference lines */}
            {liveZkcPrice !== null && (
              <ReferenceLine x={liveZkcPrice} stroke="#f59e0b" strokeDasharray="4 3" />
            )}
            <Bar dataKey="breakeven" name="breakeven" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={breakColor(entry.breakeven, liveZkcPrice)} />
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
                <td className="py-2 text-right font-mono" style={{ color: breakColor(b.breakeven_zkc, liveZkcPrice) }}>
                  {b.breakeven_zkc !== null ? fmtUsd(b.breakeven_zkc) : '—'}
                </td>
                <td className="py-2 text-right text-xs">
                  {b.breakeven_zkc === null ? (
                    <span className="text-red-400">Not profitable</span>
                  ) : liveZkcPrice !== null && b.breakeven_zkc <= liveZkcPrice ? (
                    <span className="text-green-400">Profitable</span>
                  ) : (
                    <span className="text-red-400">Not profitable</span>
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
