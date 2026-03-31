import { useState, useMemo } from 'react';
import { computeResults } from './lib/compute';
import type { ModelParams } from './lib/compute';
import { computePovwRate } from './lib/parseEpochs';
import type { EpochData } from './lib/parseEpochs';
import epochsRaw from './data/epochs.json';
import Sidebar from './components/Sidebar';
import ProfitExplorer from './components/tabs/ProfitExplorer';
import Breakeven from './components/tabs/Breakeven';
import Scenarios from './components/tabs/Scenarios';

const epochs = epochsRaw as EpochData[];
const DEFAULT_LOOKBACK = 10;
const defaultPovw = computePovwRate(epochs, DEFAULT_LOOKBACK);

const DEFAULT_PARAMS: ModelParams = {
  gpuConfigs: [
    { id: crypto.randomUUID(), label: 'RTX5090 x8', num_gpus: 8, usd_per_hour: 0.50, mhz: 1.1 },
    { id: crypto.randomUUID(), label: 'RTX5090 x4', num_gpus: 4, usd_per_hour: 0.50, mhz: 1.1 },
    { id: crypto.randomUUID(), label: 'RTX4090 x8', num_gpus: 8, usd_per_hour: 0.35, mhz: 0.7 },
    { id: crypto.randomUUID(), label: 'H100 x4', num_gpus: 4, usd_per_hour: 3.50, mhz: 1.8 },
  ],
  zkc_price_min: 0.025,
  zkc_price_max: 1.0,
  zkc_price_steps: 20,
  market_reward_usd_per_bcycle: 0.07,
  market_order_util: 0.5,
  fixed_cost_monthly_usd: 0,
  povw_zkc_per_mhz_per_epoch: defaultPovw,
};

const TABS = ['Profit Explorer', 'Break-even', 'Scenarios'] as const;
type Tab = typeof TABS[number];

export default function App() {
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [lookback, setLookback] = useState(DEFAULT_LOOKBACK);
  const [activeTab, setActiveTab] = useState<Tab>('Profit Explorer');

  const results = useMemo(() => computeResults(params), [params]);

  return (
    <div className="flex h-screen bg-[#0a0f1e] text-gray-100 overflow-hidden">
      <Sidebar
        params={params}
        onParamsChange={setParams}
        epochs={epochs}
        lookback={lookback}
        onLookbackChange={setLookback}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="bg-[#111827] border-b border-gray-800 px-6 flex items-center gap-0 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? 'text-cyan-400 border-cyan-500'
                  : 'text-gray-400 border-transparent hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="ml-auto text-xs text-gray-600 font-mono">
            v{params.zkc_price_steps + 1} price points · {params.gpuConfigs.length} configs
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'Profit Explorer' && (
            <ProfitExplorer results={results} params={params} />
          )}
          {activeTab === 'Break-even' && (
            <Breakeven params={params} />
          )}
          {activeTab === 'Scenarios' && (
            <Scenarios results={results} />
          )}
        </div>
      </div>
    </div>
  );
}
