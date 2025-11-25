import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { getState, getBids } from './services/api';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import BN from 'bn.js';
import { minerPDA } from './solana/oreSDK';
import type { StateResponse, BidsResponse } from './types/api';
import { Header } from './components/Header';
import { GridVisualization } from './components/GridVisualization';
import { TreasuryView } from './components/TreasuryView';
import { LeaderboardView } from './components/LeaderboardView';
import { StrategiesSoVView } from './components/StrategiesSoVView';
import { MyProfileView } from './components/MyProfileView';
import { MartingaleSimulationView } from './components/MartingaleSimulationView';
import { WhatIsOreView } from './components/WhatIsOreView';
import { AboutView } from './components/AboutView';
import { MinersView } from './components/MinersView';
import { DustToOreView } from './components/DustToOreView';
import { ExploreView } from './components/ExploreView';

const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11;

// Polling intervals - respecting API rate limits: 5/sec, 180/min
// Stagger requests to avoid hitting 5/sec limit
const POLL_INTERVAL = 3000; // 3 seconds for state (20 requests/min - well under 180/min limit)
const BIDS_POLL_INTERVAL = 12000; // 12 seconds for bids (5 requests/min - minimal load)
const BIDS_OFFSET = 1500; // 1.5s offset from state polling to avoid hitting 5/sec limit

type View = 'dashboard' | 'about' | 'treasury' | 'leaderboard' | 'strategies' | 'merch' | 'inflation' | 'token' | 'revenue' | 'martingale' | 'staking' | 'liquidity' | 'unrefined' | 'what-is-ore' | 'miners' | 'dust-to-ore' | 'explore';

// Main content component that uses routing
function AppContent() {
  const location = useLocation();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [state, setState] = useState<StateResponse | null>(null);
  const [bids, setBids] = useState<BidsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  
  // User bet tracking - only show confirmed on-chain deployments
  const [userBets, setUserBets] = useState<number[]>(Array(25).fill(0)); // SOL amount per square (0-24 index)
  const [lastRoundChecked, setLastRoundChecked] = useState<string | null>(null); // Track last round we checked
  const [previousStats, setPreviousStats] = useState<{
    roundId: string;
    totalSolEarned: number;
    totalOreEarned: number;
  } | null>(null);
  const [roundResults, setRoundResults] = useState<{
    roundId: string;
    solWon: number;
    oreWon: number;
  } | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const stateData = await getState();
      
      // Only update if we got valid data
      if (stateData) {
        setState(stateData);
      }
      
      // Clear error only after successful fetch
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch state';
      // Only show error if we don't have existing data (initial load)
      // If we have existing data, silently keep showing it instead of flashing error
      if (!state) {
        setError(errorMessage);
      }
      // Silently log error but don't disrupt UI if we have existing data
      console.error('Error fetching state:', err);
      // Don't clear existing state on error - keep showing last known good data
    } finally {
      setLoading(false);
    }
  }, [state]);

  const fetchBids = useCallback(async () => {
    try {
      const bidsData = await getBids();
      
      // Only update if we got valid data and bids is an array
      if (bidsData && Array.isArray(bidsData.bids)) {
        setBids(bidsData);
      }
    } catch (err) {
      // Silently fail for bids - not critical, keep showing last known data
      console.error('Error fetching bids:', err);
      // Don't clear existing bids on error - keep showing last known good data
      // Only clear if we don't have existing data (first load)
      if (!bids) {
        // Set empty bids structure to prevent errors
        setBids({ roundId: '', collectedAt: '', uniqueMiners: 0, bids: [] });
      }
    }
  }, []);

  useEffect(() => {
    // Initial fetch for state
    fetchState();
    
    // Stagger bids fetch to avoid hitting 5/sec limit
    const initialBidsTimeout = setTimeout(fetchBids, BIDS_OFFSET);

    // Set up polling for state at 3s (main data - 20 requests/min)
    const stateInterval = setInterval(fetchState, POLL_INTERVAL);

    // Set up slower polling for bids at 12s with offset (less critical - 5 requests/min)
    const bidsInterval = setInterval(() => {
      // Small delay to avoid hitting 5/sec limit when state also polls
      setTimeout(fetchBids, BIDS_OFFSET);
    }, BIDS_POLL_INTERVAL);

    return () => {
      clearTimeout(initialBidsTimeout);
      clearInterval(stateInterval);
      clearInterval(bidsInterval);
    };
  }, [fetchState, fetchBids]);

  // Fetch user bets when wallet is connected - only show confirmed on-chain deployments
  const fetchUserBets = useCallback(async () => {
    if (!connected || !publicKey || !state?.round) {
      setUserBets(Array(25).fill(0));
      setLastRoundChecked(null);
      return;
    }
    
    try {
      const authority = publicKey;
      const [minerAddress] = minerPDA(authority);
      const minerAccount = await connection.getAccountInfo(minerAddress);
      if (!minerAccount || minerAccount.data.length < 536) {
        // No miner yet – keep previous bets instead of clearing to avoid flicker
        return;
      }

      const data = minerAccount.data;
      let offset = 8; // discriminator
      offset += 32; // authority pubkey

      // deployed[25] u64
      const deployedLamports: number[] = [];
      for (let i = 0; i < 25; i++) {
        const lamportsBN = new BN(data.slice(offset, offset + 8), 'le');
        deployedLamports.push(parseFloat(lamportsBN.toString()));
        offset += 8;
      }

      // skip cumulative[25] u64
      offset += 25 * 8;
      // skip checkpoint_fee, checkpoint_id, last_claim_ore_at, last_claim_sol_at
      offset += 8 * 4;
      // skip rewards_factor (Numeric bits[16])
      offset += 16;

      // rewards_sol, rewards_ore, refined_ore (skip – not needed for UI)
      offset += 8 * 3;

      // round_id
      const roundIdBN = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;
      // lifetime_rewards_sol
      const lifetimeSolBN = new BN(data.slice(offset, offset + 8), 'le');
      offset += 8;
      // lifetime_rewards_ore
      const lifetimeOreBN = new BN(data.slice(offset, offset + 8), 'le');
      
      // Only show bets if they're from the current round and have meaningful amounts
      const currentRoundId = state.round.roundId;
      const minerRoundId = roundIdBN.toString();
      
      // If round changed, clear bets once
      if (lastRoundChecked && lastRoundChecked !== currentRoundId) {
        setUserBets(Array(25).fill(0));
      }
      
      // If miner stats are not yet on the current round, keep showing previous bets
      // instead of clearing every poll (avoids blinking).
      if (minerRoundId !== currentRoundId) {
        return;
      }
      
      // Only proceed if we're on the current round
      setLastRoundChecked(currentRoundId);
      
      // deployed is an array of 25 numbers (lamports) representing SOL deployed per square
      if (deployedLamports.length === 25) {
        const MIN_BET_THRESHOLD = 0.0001; // Only show bets above 0.0001 SOL to avoid noise
        
        const bets = deployedLamports.map(lamports => {
          const sol = lamports / LAMPORTS_PER_SOL;
          // Only return non-zero if above threshold
          return sol >= MIN_BET_THRESHOLD ? sol : 0;
        });
        
        // Only update if there are actual bets (not all zeros)
        const hasBets = bets.some(bet => bet > 0);
        if (hasBets) {
          // Only update state if bets actually changed to prevent flashing
          setUserBets(prevBets => {
            const changed = prevBets.some((prev, idx) => Math.abs(prev - bets[idx]) > 0.00001);
            return changed ? bets : prevBets;
          });
        }
        
        // Track round changes and calculate winnings
        const currentSolEarned = parseFloat(lifetimeSolBN.toString()) / LAMPORTS_PER_SOL;
        const currentOreEarned =
          parseFloat(lifetimeOreBN.toString()) / ORE_CONVERSION_FACTOR;
        
        // Check if round changed
        if (previousStats && previousStats.roundId !== currentRoundId && state.roundResult?.resultAvailable) {
          // Round finished - calculate winnings
          const solWon = currentSolEarned - previousStats.totalSolEarned;
          const oreWon = currentOreEarned - previousStats.totalOreEarned;
          
          if (solWon > 0 || oreWon > 0) {
            setRoundResults({
              roundId: previousStats.roundId,
              solWon: Math.max(0, solWon), // Ensure non-negative
              oreWon: Math.max(0, oreWon), // Ensure non-negative
            });
            
            // Clear results after 10 seconds
            setTimeout(() => setRoundResults(null), 10000);
          }
        }
        
        // Update previous stats for next round
        setPreviousStats({
          roundId: currentRoundId,
          totalSolEarned: currentSolEarned,
          totalOreEarned: currentOreEarned,
        });
      }
    } catch (err) {
      // Silently fail – keep previous bets to avoid flicker when RPC is flaky
      console.debug('Could not fetch user bets:', err);
    }
  }, [connected, publicKey, state?.round, state?.roundResult, previousStats, lastRoundChecked]);


  // Poll user bets every 10 seconds when connected (less frequent to avoid flashing)
  // Only fetch when round ID changes or on initial connection
  useEffect(() => {
    if (connected && publicKey && state?.round) {
      // Fetch immediately on round change or initial load
      fetchUserBets();
      const interval = setInterval(fetchUserBets, 10000); // Poll every 10 seconds
      return () => clearInterval(interval);
    } else {
      setUserBets(Array(25).fill(0));
      setPreviousStats(null);
      setRoundResults(null);
      setLastRoundChecked(null);
    }
  }, [connected, publicKey, state?.round?.roundId, fetchUserBets]);

  const handleRetry = () => {
    setLoading(true);
    fetchState();
    fetchBids();
  };

  // Linear countdown based on actual time
  const [countdown, setCountdown] = useState<string>('Not Started');
  const [countdownEndTime, setCountdownEndTime] = useState<number | null>(null);
  
  const currentSlot = state?.currentSlot ? parseInt(state.currentSlot) : 0;
  const endSlot = state?.round?.mining.endSlot ? parseInt(state.round.mining.endSlot) : 0;
  const status = state?.round?.mining.status || 'idle';
  const roundId = state?.round?.roundId;
  
  // Update end time when round changes or when we get new slot data
  useEffect(() => {
    if (status === 'expired' || status === 'finished') {
      setCountdown('0s left');
      setCountdownEndTime(null);
      return;
    }
    
    if (status === 'idle') {
      setCountdown('Not Started');
      setCountdownEndTime(null);
      return;
    }
    
    if (status === 'active' && endSlot > 0 && currentSlot > 0) {
      // Calculate end time based on slots remaining
      // Rough estimate: 1 slot ≈ 0.4 seconds
      const remainingSlots = Math.max(0, endSlot - currentSlot);
      const secondsRemaining = remainingSlots * 0.4;
      const now = Date.now();
      const endTime = now + (secondsRemaining * 1000);
      
      // Only update end time if round changed or we don't have one set
      setCountdownEndTime(prev => {
        // If round changed, reset the end time
        const storedRoundId = sessionStorage.getItem('countdownRoundId');
        if (storedRoundId !== roundId) {
          sessionStorage.setItem('countdownRoundId', roundId || '');
          return endTime;
        }
        // If we don't have an end time or it's significantly different (more than 5 seconds), update it
        if (prev === null || Math.abs(prev - endTime) > 5000) {
          return endTime;
        }
        // Otherwise keep the existing end time for linear countdown
        return prev;
      });
    }
  }, [status, endSlot, currentSlot, roundId]);
  
  // Linear countdown timer - updates every 100ms for smooth display
  useEffect(() => {
    if (!countdownEndTime || status !== 'active') {
      return;
    }
    
    const updateCountdown = () => {
      const now = Date.now();
      const remaining = Math.max(0, countdownEndTime - now);
      const secondsRemaining = Math.ceil(remaining / 1000);
      
      if (secondsRemaining <= 0) {
        setCountdown('0s left');
        setCountdownEndTime(null);
        return;
      }
      
      const minutes = Math.floor(secondsRemaining / 60);
      const seconds = secondsRemaining % 60;
      
      if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };
    
    // Update immediately
    updateCountdown();
    
    // Update every 100ms for smooth countdown
    const interval = setInterval(updateCountdown, 100);
    
    return () => clearInterval(interval);
  }, [countdownEndTime, status]);
  const uniqueMiners = state?.round?.uniqueMiners ? parseInt(state.round.uniqueMiners) : undefined;
  const totalBids = bids?.bids && Array.isArray(bids.bids) 
    ? bids.bids.reduce((sum, bid) => sum + (bid.count || 0), 0) 
    : 0;

  // Determine current view from location
  const getCurrentView = (): View => {
    const path = location.pathname;
    if (path === '/about') return 'about';
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
    if (path === '/miners') return 'miners';
    if (path === '/explore') return 'explore';
    return 'dashboard';
  };

  const currentView = getCurrentView();

  // Listen for wallet menu open event
  useEffect(() => {
    const handleWalletClick = () => {
      setWalletMenuOpen(true);
    };
    
    window.addEventListener('openWalletMenu', handleWalletClick);
    return () => window.removeEventListener('openWalletMenu', handleWalletClick);
  }, []);

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
        walletMenuOpen={walletMenuOpen}
        setWalletMenuOpen={setWalletMenuOpen}
      />
      <main className={`bg-black transition-all duration-700 ease-in-out ${walletMenuOpen ? 'opacity-70' : ''}`}>
        <Routes>
          <Route path="/about" element={<AboutView />} />
          <Route path="/treasury" element={<TreasuryView currentView="treasury" />} />
          <Route path="/inflation" element={<TreasuryView currentView="inflation" />} />
          <Route path="/token" element={<TreasuryView currentView="token" />} />
          <Route path="/revenue" element={<TreasuryView currentView="revenue" />} />
          <Route path="/staking" element={<TreasuryView currentView="staking" />} />
          <Route path="/liquidity" element={<TreasuryView currentView="liquidity" />} />
          <Route path="/unrefined" element={<TreasuryView currentView="unrefined" />} />
          <Route path="/miners" element={<MinersView />} />
          <Route path="/leaderboard" element={<LeaderboardView />} />
          <Route path="/strategies" element={<StrategiesSoVView />} />
          <Route path="/my-profile" element={<MyProfileView />} />
          <Route path="/martingale" element={<MartingaleSimulationView />} />
          <Route path="/what-is-ore" element={<WhatIsOreView />} />
          <Route path="/dust-to-ore" element={<DustToOreView />} />
          <Route path="/explore" element={<ExploreView />} />
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
                  userBets={connected && publicKey ? userBets : null}
                  roundResults={roundResults}
                  walletAddress={publicKey ? publicKey.toBase58() : null}
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