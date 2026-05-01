import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend,
} from 'recharts';
import type { EpochData } from '../../lib/parseEpochs';

interface Props {
  epochs: EpochData[];
  epochsLoading: boolean;
  epochsError: string | null;
}

/** Derive per-epoch PoVW data points for charting. */
function deriveChartData(epochs: EpochData[]) {
  return [...epochs]
    .sort((a, b) => a.epoch - b.epoch)
    .map(e => {
      const totalWork = e.total_cycles;
      const miningRewards = e.mining_rewards_zkc;
      // PoVW rate = mining_rewards_zkc / (total_cycles / 1e6) expressed as ZKC per MHz
      const povwRate = totalWork > 0 ? miningRewards / (totalWork / 1e6) : 0;
      // Total cycles in billions for readable display
      const totalCyclesB = totalWork / 1e9;
      return {
        epoch: e.epoch,
        totalCyclesB: parseFloat(totalCyclesB.toFixed(2)),
        miningRewardsK: parseFloat((miningRewards / 1000).toFixed(2)),
        povwRate: parseFloat(povwRate.toFixed(5)),
      };
    });
}

const fmtCycles = (v: number) => `${v.toFixed(1)}B`;
const fmtRate = (v: number) => v.toFixed(5);

export default function PovwCycles({ epochs, epochsLoading, epochsError }: Props) {
  if (epochsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⬡</div>
          <p className="text-gray-400">Loading epoch data…</p>
        </div>
      </div>
    );
  }

  if (epochsError && epochs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-2">Failed to load epoch data</p>
          <p className="text-gray-500 text-sm">{epochsError}</p>
        </div>
      </div>
    );
  }

  const data = deriveChartData(epochs);

  return (
    <div className="p-3 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-gray-100 text-lg font-semibold mb-1">PoVW Cycles</h2>
        <p className="text-gray-400 text-sm">
          Proof-of-Verifiable-Work cycle trends across epochs.
          {epochsError && (
            <span className="text-yellow-500 ml-2" title={epochsError}>⚠ {epochsError}</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {/* Total PoVW Cycles Over Time */}
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">Total PoVW Cycles per Epoch</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                label={{ value: 'Epoch', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 10 }}
              />
              <YAxis
                tickFormatter={fmtCycles}
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={55}
                label={{ value: 'Cycles (B)', angle: -90, position: 'insideLeft', offset: 30, fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(2)}B`, String(name)]}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
              />
              <Bar dataKey="totalCyclesB" name="PoVW Cycles" fill="#22d3ee" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* PoVW Reward Rate Over Time */}
        <div className="bg-[#111827] rounded-lg p-3 sm:p-4 border border-gray-800">
          <h3 className="text-gray-200 text-sm font-semibold mb-3">PoVW Reward Rate (ZKC/MHz/epoch)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ left: 5, right: 10, top: 5, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="epoch"
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
                label={{ value: 'Epoch', position: 'insideBottom', offset: -10, fill: '#9ca3af', fontSize: 10 }}
              />
              <YAxis
                tickFormatter={fmtRate}
                tick={{ fill: '#9ca3af', fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={65}
                label={{ value: 'ZKC/MHz', angle: -90, position: 'insideLeft', offset: 40, fill: '#9ca3af', fontSize: 10 }}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [fmtRate(Number(v)), String(name)]}
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 6 }}
                labelStyle={{ color: '#e5e7eb' }}
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
      </div>
    </div>
  );
}