import { useState, useMemo, useEffect } from 'react';
import { computeResults } from './lib/compute';
import type { ModelParams } from './lib/compute';
import { computePovwRate } from './lib/parseEpochs';
import type { EpochData } from './lib/parseEpochs';
import Sidebar from './components/Sidebar';
import ProfitExplorer from './components/tabs/ProfitExplorer';
import Breakeven from './components/tabs/Breakeven';
import Scenarios from './components/tabs/Scenarios';

const DEFAULT_LOOKBACK = 10;

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
  povw_zkc_per_mhz_per_epoch: 0, // populated once epochs load
};

const TABS = ['Profit Explorer', 'Break-even', 'Scenarios'] as const;
type Tab = typeof TABS[number];

export default function App() {
  const [params, setParams] = useState<ModelParams>(DEFAULT_PARAMS);
  const [lookback, setLookback] = useState(DEFAULT_LOOKBACK);
  const [activeTab, setActiveTab] = useState<Tab>('Profit Explorer');
  const [epochs, setEpochs] = useState<EpochData[]>([]);
  const [epochsLoading, setEpochsLoading] = useState(true);
  const [epochsError, setEpochsError] = useState<string | null>(null);

  // Fetch epoch data from Pages Function (falls back to bundled JSON in dev)
  useEffect(() => {
    const load = async () => {
      setEpochsLoading(true);
      setEpochsError(null);
      try {
        const res = await fetch('/api/epochs');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: EpochData[] = await res.json();
        setEpochs(data);
        setParams(p => ({
          ...p,
          povw_zkc_per_mhz_per_epoch: computePovwRate(data, DEFAULT_LOOKBACK),
        }));
      } catch (err) {
        // Fallback: load bundled epochs.json for local dev without wrangler
        try {
          const fallback = await import('./data/epochs.json');
          const data = fallback.default as EpochData[];
          setEpochs(data);
          setParams(p => ({
            ...p,
            povw_zkc_per_mhz_per_epoch: computePovwRate(data, DEFAULT_LOOKBACK),
          }));
          setEpochsError('Using bundled epoch data (API unavailable)');
        } catch {
          setEpochsError('Failed to load epoch data');
        }
      } finally {
        setEpochsLoading(false);
      }
    };
    load();
  }, []);

  // Recompute POVW rate when lookback changes
  useEffect(() => {
    if (epochs.length > 0) {
      setParams(p => ({
        ...p,
        povw_zkc_per_mhz_per_epoch: computePovwRate(epochs, lookback),
      }));
    }
  }, [lookback, epochs]);

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
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}

          {/* Epoch data status indicator */}
          <div className="ml-auto flex items-center gap-2 text-xs pr-2">
            {epochsLoading ? (
              <span className="text-gray-500 animate-pulse">Loading epoch data…</span>
            ) : epochsError ? (
              <span className="text-yellow-500" title={epochsError}>⚠ {epochsError}</span>
            ) : (
              <span className="text-gray-600">{epochs.length} epochs loaded</span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-6">
          {epochsLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-4 animate-pulse">⬡</div>
                <p className="text-gray-400">Loading epoch data…</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'Profit Explorer' && (
                <ProfitExplorer params={params} results={results} />
              )}
              {activeTab === 'Break-even' && (
                <Breakeven params={params} />
              )}
              {activeTab === 'Scenarios' && (
                <Scenarios results={results} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
