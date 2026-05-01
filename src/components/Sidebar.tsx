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
          <h1 className="text-gray-300 font-semibold text-xs uppercase tracking-wider flex-1">
            Settings
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
                step={0.001}
                value={params.zkc_price_max}
                onChange={e => set('zkc_price_max', Number(e.target.value))}
              />
            </div>
            <div>
              <label className={labelCls}>Steps</label>
              <input
                className={inputCls}
                type="number"
                min={1}
                max={100}
                value={params.zkc_price_steps}
                onChange={e => set('zkc_price_steps', Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 my-4"></div>

        {/* Market Orders */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
            Market Orders
            <TooltipIcon text="Parameters for open-market ZK proof requests fulfilled alongside PoVW mining" />
          </h2>

          <div className="mb-2">
            <label className={labelCls}>
              Reward ($/B cycle)
              <TooltipIcon text="USD reward per billion cycles for fulfilled market orders" />
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step={0.01}
              value={params.market_reward_usd_per_bcycle}
              onChange={e => set('market_reward_usd_per_bcycle', Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>
              Utilisation %
              <TooltipIcon text="Fraction of available capacity used for market orders" />
            </label>
            <input
              className={inputCls}
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={params.market_order_util}
              onChange={e => set('market_order_util', Number(e.target.value))}
            />
          </div>
        </div>

        <div className="border-t border-gray-800 my-4"></div>

        {/* PoVW */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">
            PoVW Mining
            <TooltipIcon text="Proof-of-Verifiable-Work: mining rewards are computed automatically from live epoch data" />
          </h2>

          <div className="mb-2">
            <label className={labelCls}>Lookback (epochs)</label>
            <input
              className={inputCls}
              type="number"
              min={1}
              max={100}
              value={lookback}
              onChange={e => handleLookbackChange(Number(e.target.value))}
            />
          </div>
          <div>
            <label className={labelCls}>PoVW rate (auto)</label>
            <div className="w-full bg-[#0a0f1e] border border-gray-700 rounded px-2 py-1 text-cyan-400 font-mono text-sm">
              {computedPovw.toFixed(5)} ZKC/MHz/epoch
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 my-4"></div>

        {/* Fixed Costs */}
        <div className={sectionCls}>
          <h2 className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-2">Fixed Costs</h2>
          <div>
            <label className={labelCls}>Monthly (USD)</label>
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
      </div>
    </div>
  );
}