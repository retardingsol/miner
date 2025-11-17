import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { getState, getBids } from './services/api';
import type { StateResponse, BidsResponse } from './types/api';
import { Header } from './components/Header';
import { GridVisualization } from './components/GridVisualization';
import { TreasuryView } from './components/TreasuryView';
import { LeaderboardView } from './components/LeaderboardView';
import { StrategiesSoVView } from './components/StrategiesSoVView';
import { MyProfileView } from './components/MyProfileView';
import { MartingaleSimulationView } from './components/MartingaleSimulationView';
import { WhatIsOreView } from './components/WhatIsOreView';

const POLL_INTERVAL = 5000; // 5 seconds for main data
const GRID_POLL_INTERVAL = 1000; // 1 second for grid updates

type View = 'dashboard' | 'treasury' | 'leaderboard' | 'strategies' | 'merch' | 'inflation' | 'token' | 'revenue' | 'martingale' | 'staking' | 'liquidity' | 'unrefined' | 'what-is-ore';

// Main content component that uses routing
function AppContent() {
  const location = useLocation();
  const [state, setState] = useState<StateResponse | null>(null);
  const [bids, setBids] = useState<BidsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [stateData, bidsData] = await Promise.all([
        getState(),
        getBids(),
      ]);
      setState(stateData);
      setBids(bidsData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGridData = useCallback(async () => {
    try {
      const stateData = await getState();
      setState(stateData);
    } catch (err) {
      // Silently fail for grid updates to avoid disrupting the UI
      console.error('Error fetching grid data:', err);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling for main data
    const interval = setInterval(fetchData, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    // Set up more frequent polling for grid visualization
    if (state?.round) {
      const gridInterval = setInterval(fetchGridData, GRID_POLL_INTERVAL);
      return () => clearInterval(gridInterval);
    }
  }, [state?.round, fetchGridData]);

  const handleRetry = () => {
    setLoading(true);
    fetchData();
  };

  // Calculate countdown
  const currentSlot = state?.currentSlot ? parseInt(state.currentSlot) : 0;
  const endSlot = state?.round?.mining.endSlot ? parseInt(state.round.mining.endSlot) : 0;
  const remainingSlots = Math.max(0, endSlot - currentSlot);
  const status = state?.round?.mining.status || 'idle';
  
  const formatCountdown = () => {
    if (status === 'expired' || status === 'finished') {
      return '0s left';
    }
    if (status === 'idle') {
      return 'Not Started';
    }
    // Rough estimate: 1 slot ≈ 0.4 seconds
    const secondsRemaining = remainingSlots * 0.4;
    const minutes = Math.floor(secondsRemaining / 60);
    const seconds = Math.floor(secondsRemaining % 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const countdown = formatCountdown();
  const uniqueMiners = state?.round?.uniqueMiners ? parseInt(state.round.uniqueMiners) : undefined;
  const totalBids = bids?.bids.reduce((sum, bid) => sum + bid.count, 0);

  // Determine current view from location
  const getCurrentView = (): View => {
    const path = location.pathname;
    if (path === '/treasury') return 'treasury';
    if (path === '/inflation') return 'inflation';
    if (path === '/token') return 'token';
    if (path === '/revenue') return 'revenue';
    if (path === '/leaderboard') return 'leaderboard';
    if (path === '/strategies') return 'strategies';
    if (path === '/my-profile') return 'merch';
    if (path === '/martingale') return 'martingale';
    if (path === '/staking') return 'staking';
    if (path === '/liquidity') return 'liquidity';
    if (path === '/unrefined') return 'unrefined';
    return 'dashboard';
  };

  const currentView = getCurrentView();

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading ORE data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <Header 
        solPrice={state?.solPrice || null}
        orePrice={state?.orePrice || null}
        currentView={currentView}
      />
      <main className="bg-black">
        <Routes>
          <Route path="/treasury" element={<TreasuryView currentView="treasury" />} />
          <Route path="/inflation" element={<TreasuryView currentView="inflation" />} />
          <Route path="/token" element={<TreasuryView currentView="token" />} />
          <Route path="/revenue" element={<TreasuryView currentView="revenue" />} />
          <Route path="/staking" element={<TreasuryView currentView="staking" />} />
          <Route path="/liquidity" element={<TreasuryView currentView="liquidity" />} />
          <Route path="/unrefined" element={<TreasuryView currentView="unrefined" />} />
          <Route path="/leaderboard" element={<LeaderboardView />} />
          <Route path="/strategies" element={<StrategiesSoVView />} />
          <Route path="/my-profile" element={<MyProfileView />} />
          <Route path="/martingale" element={<MartingaleSimulationView />} />
          <Route path="/what-is-ore" element={<WhatIsOreView />} />
          <Route path="/" element={
            <div className="py-8 px-4">
              <div className="max-w-7xl mx-auto">
                {/* Error Banner */}
                {error && (
                  <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-red-400 font-semibold">Error loading data</p>
                      <p className="text-red-300 text-sm mt-1">{error}</p>
                    </div>
                    <button
                      onClick={handleRetry}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/50 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Grid Visualization - Full Width */}
                <GridVisualization 
                  perSquare={state?.round?.perSquare || null}
                  winningSquareIndex={
                    state?.roundResult?.winningSquareIndex !== undefined
                      ? state.roundResult.winningSquareIndex
                      : state?.roundResult?.winningSquareLabel
                        ? parseInt(state.roundResult.winningSquareLabel.replace('#', '')) - 1
                        : null
                  }
                  countdown={countdown}
                  uniqueMiners={uniqueMiners}
                  totalBids={totalBids}
                  roundId={state?.round?.roundId}
                  state={state}
                  bids={bids}
                  roundResult={state?.roundResult || null}
                  roundStatus={status}
                />

                {/* Loading Indicator */}
                {loading && state && (
                  <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-400"></div>
                    <span className="text-sm text-slate-400">Updating...</span>
                  </div>
                )}
              </div>
            </div>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
