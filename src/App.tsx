import { useState, useMemo, useEffect, useCallback } from 'react';
import { computeResults } from './lib/compute';
import type { ModelParams } from './lib/compute';
import { computePovwRate } from './lib/parseEpochs';
import type { EpochData } from './lib/parseEpochs';
import { useLocalStorage } from './lib/useLocalStorage';
import Sidebar from './components/Sidebar';
import ZkcTicker from './components/ZkcTicker';
import ProfitExplorer from './components/tabs/ProfitExplorer';
import Breakeven from './components/tabs/Breakeven';
import Scenarios from './components/tabs/Scenarios';

const DEFAULT_LOOKBACK = 10;

const DEFAULT_PARAMS: ModelParams = {
  gpuConfigs: [
    { id: 'gpu-1', label: 'RTX5090 x8', num_gpus: 8, usd_per_hour: 0.50, mhz: 1.1 },
    { id: 'gpu-2', label: 'RTX4090 x8', num_gpus: 8, usd_per_hour: 0.35, mhz: 0.7 },
  ],
  zkc_price_min: 0,
  zkc_price_max: 0.5,
  zkc_price_steps: 20,
  market_reward_usd_per_bcycle: 0.07,
  market_order_util: 0.5,
  fixed_cost_monthly_usd: 0,
  povw_zkc_per_mhz_per_epoch: 0, // always recomputed from live epoch data
};

const TABS = ['Profit Explorer', 'Break-even', 'Scenarios'] as const;
type Tab = typeof TABS[number];

export default function App() {
  const [params, setParams] = useLocalStorage<ModelParams>('params', DEFAULT_PARAMS);
  const [lookback, setLookback] = useLocalStorage<number>('lookback', DEFAULT_LOOKBACK);
  const [activeTab, setActiveTab] = useState<Tab>('Profit Explorer');
  const [epochs, setEpochs] = useState<EpochData[]>([]);
  const [epochsLoading, setEpochsLoading] = useState(true);
  const [epochsError, setEpochsError] = useState<string | null>(null);
  const [liveZkcPrice, setLiveZkcPrice] = useState<number | null>(null);

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
      } catch {
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

  // Called by ZkcTicker when price loads — passed to Sidebar for "use live price" button
  const handlePriceLoad = useCallback((price: number) => {
    setLiveZkcPrice(price);
  }, []);

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
        {/* Header bar */}
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

          {/* Right side: ticker + epoch status + GitHub link */}
          <div className="ml-auto flex items-center gap-4 pr-2">
            <ZkcTicker onPriceLoad={handlePriceLoad} />
            <span className="w-px h-4 bg-gray-700" />
            {epochsLoading ? (
              <span className="text-gray-500 text-xs animate-pulse">Loading epochs…</span>
            ) : epochsError ? (
              <span className="text-yellow-500 text-xs" title={epochsError}>⚠ {epochsError}</span>
            ) : (
              <span className="text-gray-600 text-xs">{epochs.length} epochs</span>
            )}
            <span className="w-px h-4 bg-gray-700" />
            <a
              href="https://github.com/zerokrab/boundless-profit-explorer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="View on GitHub"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-label="GitHub">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
            </a>
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto p-6 pb-0">
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
                <ProfitExplorer params={params} results={results} liveZkcPrice={liveZkcPrice} />
              )}
              {activeTab === 'Break-even' && (
                <Breakeven params={params} liveZkcPrice={liveZkcPrice} />
              )}
              {activeTab === 'Scenarios' && (
                <Scenarios results={results} liveZkcPrice={liveZkcPrice} />
              )}
            </>
          )}
        </div>
        {/* Footer */}
        <div className="flex-shrink-0 border-t border-gray-800 px-6 py-2 flex items-center justify-end">
          <span className="text-gray-600 text-xs">
            Made by{' '}
            <a
              href="https://github.com/zerokrab"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-cyan-400 transition-colors"
            >
              zerokrab
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
