import { useState, useMemo, useEffect, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
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
import PovwCycles from './components/tabs/PovwCycles';
import { Menu } from 'lucide-react';

const DEFAULT_LOOKBACK = 10;

const PAGES: { label: string; path: string }[] = [
  { label: 'Calculator', path: '/' },
  { label: 'PoVW Cycles', path: '/povw-cycles' },
];

const CALCULATOR_TABS: { label: string; path: string }[] = [
  { label: 'Profit Explorer', path: '/' },
  { label: 'Break-even', path: '/break-even' },
  { label: 'Scenarios', path: '/scenarios' },
];

const DEFAULT_PARAMS: ModelParams = {
  gpuConfigs: [
    { id: 'gpu-1', label: 'RTX5090 x8', num_gpus: 8, usd_per_hour: 0.75, mhz: 1.1 },
    { id: 'gpu-2', label: 'RTX4090 x8', num_gpus: 8, usd_per_hour: 0.35, mhz: 0.7 },
  ],
  zkc_price_min: 0,
  zkc_price_max: 0.5,
  zkc_price_steps: 20,
  market_reward_usd_per_bcycle: 0.10,
  market_order_util: 0.5,
  fixed_cost_monthly_usd: 0,
  povw_zkc_per_mhz_per_epoch: 0, // always recomputed from live epoch data
};

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-label="GitHub">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  );
}

const GITHUB_URL = 'https://github.com/zerokrab/boundless-profit-explorer';

export default function App() {
  const [params, setParams] = useLocalStorage<ModelParams>('params', DEFAULT_PARAMS);
  const [lookback, setLookback] = useLocalStorage<number>('lookback', DEFAULT_LOOKBACK);
  const [epochs, setEpochs] = useState<EpochData[]>([]);
  const [epochsLoading, setEpochsLoading] = useState(true);
  const [epochsError, setEpochsError] = useState<string | null>(null);
  const [liveZkcPrice, setLiveZkcPrice] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const location = useLocation();
  const isCalcPage = location.pathname !== '/povw-cycles';

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

  useEffect(() => {
    if (epochs.length > 0) {
      setParams(p => ({
        ...p,
        povw_zkc_per_mhz_per_epoch: computePovwRate(epochs, lookback),
      }));
    }
  }, [lookback, epochs]);

  const handlePriceLoad = useCallback((price: number) => {
    setLiveZkcPrice(price);
  }, []);

  const results = useMemo(() => computeResults(params), [params]);

  return (
    <div className="flex flex-col h-screen bg-[#0a0f1e] text-gray-100 overflow-hidden">
      {/* ---- Top bar: brand + page nav + right-side info ---- */}
      <div className="bg-[#0d1224] border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center h-11 px-3 sm:px-6 gap-3">
          {/* Mobile sidebar toggle (Calculator page only) */}
          {isCalcPage && (
            <button
              className="p-1.5 text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open settings"
            >
              <Menu size={20} />
            </button>
          )}

          {/* Brand */}
          <span className="text-cyan-400 font-bold text-sm tracking-wide flex-shrink-0">
            Boundless Explorer
          </span>

          {/* Page-level navigation — pill-style, visually distinct from sub-tabs */}
          <nav className="flex items-center gap-1 ml-4 sm:ml-8 overflow-x-auto scrollbar-hide">
            {PAGES.map(page => (
              <NavLink
                key={page.path}
                to={page.path}
                end={page.path === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-400/15 text-cyan-400'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`
                }
              >
                {page.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop-only right side */}
          <div className="hidden lg:flex ml-auto items-center gap-4 flex-shrink-0">
            <ZkcTicker onPriceLoad={handlePriceLoad} />
            <span className="w-px h-4 bg-gray-700" />
            {epochsLoading ? (
              <span className="text-gray-500 text-xs animate-pulse">Loading…</span>
            ) : epochsError ? (
              <span className="text-yellow-500 text-xs" title={epochsError}>⚠ {epochsError}</span>
            ) : (
              <span className="text-gray-600 text-xs">{epochs.length} epochs</span>
            )}
            <span className="w-px h-4 bg-gray-700" />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="View on GitHub"
            >
              <GithubIcon />
            </a>
          </div>
        </div>
      </div>

      {/* ---- Calculator sub-tab bar (only on Calculator page) ---- */}
      {isCalcPage && (
        <div className="bg-[#111827] border-b border-gray-800 flex-shrink-0">
          {/* Mobile-only: ticker + epoch status */}
          <div className="flex items-center px-3 sm:px-6 py-1.5 gap-3 lg:hidden">
            <ZkcTicker onPriceLoad={handlePriceLoad} />
            <span className="w-px h-4 bg-gray-700 flex-shrink-0" />
            {epochsLoading ? (
              <span className="text-gray-500 text-xs animate-pulse">Loading…</span>
            ) : epochsError ? (
              <span className="text-yellow-500 text-xs" title={epochsError}>⚠ {epochsError}</span>
            ) : (
              <span className="text-gray-600 text-xs">{epochs.length} epochs</span>
            )}
            <span className="ml-auto">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="View on GitHub"
              >
                <GithubIcon />
              </a>
            </span>
          </div>
          {/* Sub-tab navigation */}
          <div className="flex items-center px-3 sm:px-6 gap-0 overflow-x-auto scrollbar-hide">
            {CALCULATOR_TABS.map(tab => (
              <NavLink
                key={tab.path}
                to={tab.path}
                end={tab.path === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
                    isActive
                      ? 'border-cyan-400 text-cyan-400'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* ---- Page content area ---- */}
      <div className="flex-1 overflow-hidden">
        <Routes>
          {/* Calculator routes with sidebar layout */}
          <Route
            path="/"
            element={
              <div className="flex h-full">
                {/* Mobile sidebar backdrop */}
                {sidebarOpen && (
                  <div
                    className="fixed inset-0 bg-black/60 z-20 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                  />
                )}

                {/* Sidebar — hidden off-screen on mobile, visible on lg+ */}
                <div className={`
                  fixed lg:static inset-y-0 left-0 z-30
                  transform transition-transform duration-200 ease-in-out
                  ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                  <Sidebar
                    params={params}
                    onParamsChange={setParams}
                    epochs={epochs}
                    lookback={lookback}
                    onLookbackChange={setLookback}
                    onClose={() => setSidebarOpen(false)}
                  />
                </div>

                {/* Calculator main content */}
                <div className="flex-1 overflow-auto pb-0 min-w-0">
                  {epochsLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-4xl mb-4 animate-pulse">⬡</div>
                        <p className="text-gray-400">Loading epoch data…</p>
                      </div>
                    </div>
                  ) : (
                    <Outlet />
                  )}
                </div>
              </div>
            }
          >
            <Route index element={<ProfitExplorer params={params} results={results} liveZkcPrice={liveZkcPrice} />} />
            <Route path="break-even" element={<Breakeven params={params} liveZkcPrice={liveZkcPrice} />} />
            <Route path="scenarios" element={<Scenarios results={results} liveZkcPrice={liveZkcPrice} />} />
          </Route>

          {/* PoVW Cycles page — full-width, no sidebar */}
          <Route
            path="/povw-cycles"
            element={
              <div className="h-full overflow-auto">
                <PovwCycles epochs={epochs} epochsLoading={epochsLoading} epochsError={epochsError} />
              </div>
            }
          />

          {/* Catch-all: redirect unknown paths to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
  );
}