import { X } from 'lucide-react';
import type { GpuConfig, ModelParams } from '../lib/compute';
import { computePovwRate } from '../lib/parseEpochs';
import type { EpochData } from '../lib/parseEpochs';
import GpuConfigTable from './GpuConfigTable';
import TooltipIcon from './TooltipIcon';

interface Props {
  params: ModelParams;
  onParamsChange: (p: ModelParams) => void;
  epochs: EpochData[];
  lookback: number;
  onLookbackChange: (n: number) => void;
  onClose?: () => void;
}

const labelCls = "block text-xs text-gray-400 mb-1 font-medium";
const inputCls = "w-full bg-[#0a0f1e] border border-gray-700 rounded px-2 py-1 text-gray-100 font-mono text-sm focus:outline-none focus:border-cyan-500";
const sectionCls = "mb-4";

export default function Sidebar({ params, onParamsChange, epochs, lookback, onLookbackChange, onClose }: Props) {
  const set = <K extends keyof ModelParams>(key: K, value: ModelParams[K]) => {
    onParamsChange({ ...params, [key]: value });
  };

  const computedPovw = computePovwRate(epochs, lookback);

  const handleLookbackChange = (n: number) => {
    onLookbackChange(n);
    onParamsChange({ ...params, povw_zkc_per_mhz_per_epoch: computePovwRate(epochs, n) });
  };

  return (
    <div className="w-80 min-w-[320px] bg-[#111827] border-r border-gray-800 h-screen overflow-y-auto shrink-0">
      <div className="p-4">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-2 h-2 rounded-full bg-cyan-400 shrink-0"></div>
          <h1 className="text-cyan-400 font-semibold text-sm tracking-wider uppercase flex-1">
            Boundless Profit Explorer
          </h1>
          {/* Close button — visible on mobile only */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 text-gray-500 hover:text-gray-300 transition-colors shrink-0"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* GPU Configs */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">GPU Configurations</h2>
          <GpuConfigTable
            configs={params.gpuConfigs}
            onChange={(configs: GpuConfig[]) => set('gpuConfigs', configs)}
          />
        </div>

        <div className="border-t border-gray-800 my-4"></div>

        {/* ZKC Price Range */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">ZKC Price Range</h2>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Min ($)</label>
              <input
                className={inputCls}
                type="number"
                min={0}
                step={0.001}
                value={params.zkc_price_min}
                onChange={e => set('zkc_price_min', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Max ($)</label>
              <input
                className={inputCls}
                type="number"
                min={0}
                step={0.01}
                value={params.zkc_price_max}
                onChange={e => set('zkc_price_max', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Steps</label>
              <input
                className={inputCls}
                type="number"
                min={5}
                max={100}
                step={1}
                value={params.zkc_price_steps}
                onChange={e => set('zkc_price_steps', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 my-4"></div>

        {/* Market Reward */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Market Parameters</h2>
          <div className="mb-3">
            <label className={labelCls}>
              <span>Market Reward<TooltipIcon text="Average market payout in USD per billion cycles." /></span> : <span className="text-cyan-400 font-mono">${params.market_reward_usd_per_bcycle.toFixed(2)}/Bcycle</span>
            </label>
            <input
              type="range"
              min={0.01}
              max={0.20}
              step={0.01}
              value={params.market_reward_usd_per_bcycle}
              onChange={e => set('market_reward_usd_per_bcycle', Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-gray-600 text-xs mt-0.5">
              <span>$0.01</span><span>$0.20</span>
            </div>
          </div>
          <div className="mb-3">
            <label className={labelCls}>
              <span>Market Utilization<TooltipIcon text="Percent of total cycles performed on the market." /></span> : <span className="text-cyan-400 font-mono">{Math.round(params.market_order_util * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={params.market_order_util * 100}
              onChange={e => set('market_order_util', Number(e.target.value) / 100)}
              className="w-full accent-cyan-500"
            />
            <div className="flex justify-between text-gray-600 text-xs mt-0.5">
              <span>0%</span><span>100%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Fixed Cost Monthly ($)</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step={10}
              value={params.fixed_cost_monthly_usd}
              onChange={e => set('fixed_cost_monthly_usd', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border-t border-gray-800 my-4"></div>

        {/* POVW Rate */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">POVW Rate</h2>
          <div className="bg-[#0a0f1e] rounded p-2 mb-2">
            <div className="text-gray-400 text-xs mb-1">Computed from last {lookback} epochs:</div>
            <div className="text-cyan-400 font-mono text-sm font-semibold">
              {computedPovw.toFixed(5)} ZKC/MHz/epoch
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Lookback Epochs <TooltipIcon text="Number of most recent epochs used to compute the POVW reward rate." />
            </label>
            <input
              className={inputCls}
              type="number"
              min={1}
              max={50}
              step={1}
              value={lookback}
              onChange={e => handleLookbackChange(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
