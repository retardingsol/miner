import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GridVisualization } from './GridVisualization';
import { SolanaLogo } from './SolanaLogo';
import { getState, getBids } from '../services/api';
import type { StateResponse, BidsResponse } from '../types/api';

interface RoundResult {
  roundNumber: number;
  betSol: number;
  selectedSquare: number;
  winningSquare: number;
  won: boolean;
  totalDeployedSol: number;
  ourShare: number; // Our share of the winning square
  winningsSol: number;
  oreEarned: number;
  motherlodeHit: boolean;
  motherlodeOre: number;
  netProfitSol: number;
  cumulativeSolDeployed: number;
  cumulativeOreEarned: number;
  cumulativeNetProfitSol: number;
}

interface SimulationStats {
  totalRounds: number;
  wins: number;
  losses: number;
  winRate: number;
  totalSolDeployed: number;
  totalOreEarned: number;
  totalNetProfitSol: number;
  maxDrawdownSol: number;
  maxBetPlaced: number;
  currentBet: number;
  longestLossStreak: number;
  currentLossStreak: number;
}

export function MartingaleSimulationView() {
  const [initialBet, setInitialBet] = useState(0.1);
  const [selectedSquare, setSelectedSquare] = useState(1); // 1-25
  const [maxRounds, setMaxRounds] = useState(100);
  const [isRunning, setIsRunning] = useState(false);
  const [rounds, setRounds] = useState<RoundResult[]>([]);
  const [simulationSpeed] = useState(1000); // ms between API polls (1 second)
  
  // Real API state
  const [realState, setRealState] = useState<StateResponse | null>(null);
  const [realBids, setRealBids] = useState<BidsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelpTooltip, setShowHelpTooltip] = useState(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track processed round IDs to avoid duplicates
  const processedRoundsRef = useRef<Set<string>>(new Set());
  const lastRoundIdRef = useRef<string | null>(null);
  const currentBetRef = useRef<number>(0.1);
  const roundNumberRef = useRef<number>(0);

  // Calculate statistics
  const stats: SimulationStats = useMemo(() => {
    if (rounds.length === 0) {
      return {
        totalRounds: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalSolDeployed: 0,
        totalOreEarned: 0,
        totalNetProfitSol: 0,
        maxDrawdownSol: 0,
        maxBetPlaced: 0,
        currentBet: initialBet,
        longestLossStreak: 0,
        currentLossStreak: 0,
      };
    }

    const lastRound = rounds[rounds.length - 1];
    const wins = rounds.filter(r => r.won).length;
    const losses = rounds.filter(r => !r.won).length;
    
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let longestStreak = 0;
    let currentStreak = 0;
    let maxBet = 0;

    rounds.forEach((round) => {
      if (round.betSol > maxBet) maxBet = round.betSol;
      
      if (round.netProfitSol < 0) {
        currentDrawdown += Math.abs(round.netProfitSol);
        if (currentDrawdown > maxDrawdown) {
          maxDrawdown = currentDrawdown;
        }
      } else {
        currentDrawdown = 0;
      }

      if (!round.won) {
        currentStreak++;
        if (currentStreak > longestStreak) {
          longestStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    // Current loss streak
    let currentLossStreak = 0;
    for (let i = rounds.length - 1; i >= 0; i--) {
      if (!rounds[i].won) {
        currentLossStreak++;
      } else {
        break;
      }
    }

    return {
      totalRounds: rounds.length,
      wins,
      losses,
      winRate: rounds.length > 0 ? (wins / rounds.length) * 100 : 0,
      totalSolDeployed: lastRound.cumulativeSolDeployed,
      totalOreEarned: lastRound.cumulativeOreEarned,
      totalNetProfitSol: lastRound.cumulativeNetProfitSol,
      maxDrawdownSol: maxDrawdown,
      maxBetPlaced: maxBet,
      currentBet: lastRound.betSol,
      longestLossStreak: longestStreak,
      currentLossStreak: currentLossStreak,
    };
  }, [rounds, initialBet]);

  // Process a real round result from the API
  const processRealRound = useCallback((state: StateResponse): RoundResult | null => {
    if (!state.round || !state.roundResult?.resultAvailable) {
      return null;
    }

    const roundId = state.round.roundId;
    
    // Skip if we've already processed this round
    if (processedRoundsRef.current.has(roundId)) {
      return null;
    }

    // Get current bet (from ref, or initial bet if first round)
    const currentBet = currentBetRef.current || initialBet;
    
    // Get winning square
    const winningSquareIndex = state.roundResult.winningSquareIndex !== undefined
      ? state.roundResult.winningSquareIndex
      : state.roundResult.winningSquareLabel
        ? parseInt(state.roundResult.winningSquareLabel.replace('#', '')) - 1
        : null;

    if (winningSquareIndex === null || winningSquareIndex < 0 || winningSquareIndex >= 25) {
      return null;
    }

    const winningSquare = winningSquareIndex + 1;
    const won = winningSquare === selectedSquare;

    // Get total deployed SOL from the round
    const totalDeployedSol = parseFloat(state.round.totals.deployedSol || '0');
    
    // Calculate our share of the winning square
    let ourShare = 0;
    let winningsSol = 0;
    let oreEarned = 0;
    let motherlodeHit = state.roundResult.motherlodeHit || false;
    let motherlodeOre = 0;

    if (won && state.round.perSquare) {
      // Get deployed SOL on the winning square
      const winningSquareDeployed = parseFloat(state.round.perSquare.deployedSol[winningSquareIndex] || '0');
      
      if (winningSquareDeployed > 0) {
        // Our share is our bet divided by total deployed on winning square
        // Note: In reality, we'd need to know how much we actually bet, but for simulation
        // we'll use our bet amount and assume it's part of the total
        ourShare = Math.min(currentBet / winningSquareDeployed, 1);
        
        // Calculate winnings: 90% of total deployed SOL goes to winners
        const totalWinnings = parseFloat(state.roundResult.totalWinningsSol || '0');
        winningsSol = totalWinnings * ourShare;
        
        // ORE earned: ~1.2 ORE per round, split by share
        // We estimate based on our share of the winning square
        const orePerRound = 1.2;
        oreEarned = orePerRound * ourShare;
        
        // Motherlode
        if (motherlodeHit) {
          const motherlodeAmount = parseFloat(state.roundResult.motherlodeFormatted.replace(/[^\d.]/g, '') || '0');
          motherlodeOre = motherlodeAmount * ourShare;
          oreEarned += motherlodeOre;
        }
      }
    }

    // Get previous cumulative values
    const previousRound = rounds.length > 0 ? rounds[rounds.length - 1] : null;
    const previousCumulative = previousRound
      ? {
          solDeployed: previousRound.cumulativeSolDeployed,
          oreEarned: previousRound.cumulativeOreEarned,
          netProfitSol: previousRound.cumulativeNetProfitSol,
        }
      : {
          solDeployed: 0,
          oreEarned: 0,
          netProfitSol: 0,
        };

    const netProfitSol = winningsSol - currentBet;
    const cumulativeSolDeployed = previousCumulative.solDeployed + currentBet;
    const cumulativeOreEarned = previousCumulative.oreEarned + oreEarned;
    const cumulativeNetProfitSol = previousCumulative.netProfitSol + netProfitSol;

    // Mark this round as processed
    processedRoundsRef.current.add(roundId);

    // Update current bet based on Martingale strategy
    if (won) {
      // Reset to initial bet after win
      currentBetRef.current = initialBet;
    } else {
      // Double the bet after loss
      currentBetRef.current = currentBet * 2;
    }

    roundNumberRef.current += 1;

    return {
      roundNumber: roundNumberRef.current,
      betSol: currentBet,
      selectedSquare,
      winningSquare,
      won,
      totalDeployedSol,
      ourShare,
      winningsSol,
      oreEarned,
      motherlodeHit,
      motherlodeOre,
      netProfitSol,
      cumulativeSolDeployed,
      cumulativeOreEarned,
      cumulativeNetProfitSol,
    };
  }, [selectedSquare, initialBet, rounds]);

  // Fetch real data from API
  const fetchRealData = useCallback(async () => {
    if (!isRunning) return;

    try {
      // Only show loading indicator after a delay (500ms) to avoid flashing
      loadingTimeoutRef.current = setTimeout(() => {
      setLoading(true);
      }, 500);
      
      setError(null);
      const [stateData, bidsData] = await Promise.all([
        getState(),
        getBids(),
      ]);
      
      setRealState(stateData);
      setRealBids(bidsData);

      // Check if we have a new round result to process
      if (stateData.roundResult?.resultAvailable && stateData.round?.roundId) {
        const roundId = stateData.round.roundId;
        
        // Only process if this is a new round (different from last processed)
        if (roundId !== lastRoundIdRef.current) {
          const roundResult = processRealRound(stateData);
          
          if (roundResult) {
            setRounds(prev => [...prev, roundResult]);
            lastRoundIdRef.current = roundId;
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('Error fetching real data:', err);
    } finally {
      // Clear the timeout if it hasn't fired yet
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
    }
  }, [isRunning, processRealRound]);

  // Poll API for real round data
  useEffect(() => {
    if (!isRunning) {
      // Clear any pending loading timeout when stopped
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchRealData();

    // Set up polling
    const interval = setInterval(fetchRealData, simulationSpeed);

    return () => {
      clearInterval(interval);
      // Clear timeout on cleanup
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [isRunning, simulationSpeed, fetchRealData]);

  // Initialize current bet when initial bet changes
  useEffect(() => {
    if (rounds.length === 0) {
      currentBetRef.current = initialBet;
    }
  }, [initialBet, rounds.length]);

  const handleStart = () => {
    if (rounds.length >= maxRounds && maxRounds > 0) {
      handleReset();
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setRounds([]);
    processedRoundsRef.current.clear();
    lastRoundIdRef.current = null;
    currentBetRef.current = initialBet;
    roundNumberRef.current = 0;
    setRealState(null);
    setRealBids(null);
    setError(null);
  };

  const handleStep = async () => {
    if (!isRunning) {
      // Do a single fetch
      try {
        // Only show loading indicator after a delay
        loadingTimeoutRef.current = setTimeout(() => {
        setLoading(true);
        }, 500);
        
        const [stateData, bidsData] = await Promise.all([
          getState(),
          getBids(),
        ]);
        
        setRealState(stateData);
        setRealBids(bidsData);

        if (stateData.roundResult?.resultAvailable && stateData.round?.roundId) {
          const roundId = stateData.round.roundId;
          if (roundId !== lastRoundIdRef.current) {
            const roundResult = processRealRound(stateData);
            if (roundResult) {
              setRounds(prev => [...prev, roundResult]);
              lastRoundIdRef.current = roundId;
            }
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
      } finally {
        // Clear the timeout if it hasn't fired yet
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        setLoading(false);
      }
    }
  };

  const formatSol = (value: number) => {
    return value.toFixed(4);
  };

  const formatOre = (value: number) => {
    return value.toFixed(4);
  };

  // Calculate countdown from real state
  const calculateCountdown = () => {
    if (!realState?.round) return 'Waiting for Round';
    
    const currentSlot = realState.currentSlot ? parseInt(realState.currentSlot) : 0;
    const endSlot = realState.round.mining.endSlot ? parseInt(realState.round.mining.endSlot) : 0;
    const remainingSlots = Math.max(0, endSlot - currentSlot);
    const status = realState.round.mining.status || 'idle';
    
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

  const countdown = realState ? calculateCountdown() : 'Waiting for Round';

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-3">Martingale Strategy Tracker</h1>
          <p className="text-slate-400 text-sm mb-4">
            Track the Martingale betting system applied to real ORE mining rounds. Pick a square, start with a small bet, 
            double on losses, reset on wins. Uses live data from the ORE API to track actual round results.
          </p>
          
          {/* Help Info Banner */}
          <div className="relative">
            <button
              onClick={() => setShowHelpTooltip(!showHelpTooltip)}
              className="w-full bg-amber-500/10 border-2 border-amber-500/30 hover:border-amber-500/50 rounded-lg p-4 flex items-center justify-between transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="text-amber-400 font-semibold text-sm">Learn about the Martingale Strategy</p>
                  <p className="text-amber-300/70 text-xs mt-0.5">Click to see detailed explanation and theory</p>
                </div>
              </div>
              <svg 
                className={`w-5 h-5 text-amber-400 transition-transform flex-shrink-0 ${showHelpTooltip ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showHelpTooltip && (
              <div className="mt-3 bg-slate-800 border-2 border-slate-600 rounded-lg shadow-xl p-6">
                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <h4 className="font-semibold text-amber-400 mb-2 text-base">What is the Martingale Strategy?</h4>
                    <p className="text-slate-400 leading-relaxed">
                      The Martingale is a betting strategy where you double your bet after each loss, with the theory that 
                      when you eventually win, you'll recover all previous losses plus a profit equal to your original bet.
                    </p>
                    <p className="text-slate-400 leading-relaxed mt-2">
                      In traditional betting, the Martingale System is used for near-even odds (e.g., roulette red/black), 
                      but it could possibly be applied to ORE mining as well, despite the lower win probability (4% vs ~50%).
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-400 mb-2 text-base">How It Works in ORE Mining:</h4>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-400 ml-2">
                      <li><strong className="text-slate-300">Pick one square and stick to it</strong> - Squares are equivalent due to random selection</li>
                      <li><strong className="text-slate-300">Start with a small initial SOL bet</strong> (e.g., 0.1 SOL) in round 1</li>
                      <li><strong className="text-slate-300">If you lose (96% chance)</strong> - Double your bet for the next round (0.2 SOL, then 0.4 SOL, etc.)</li>
                      <li><strong className="text-slate-300">If you win (4% chance)</strong> - Recover losses via the ~24x net profit multiplier, earn your ORE share, then reset to initial bet</li>
                      <li><strong className="text-slate-300">Repeat</strong> the process</li>
                    </ol>
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-400 mb-2 text-base">The Motherlode Convexity:</h4>
                    <p className="text-slate-400 leading-relaxed">
                      One interesting caveat — the motherlode adds convexity. If it hits during a win with a double-up bet, 
                      your proportional ORE share could be exponential. This means that when the motherlode is triggered on your 
                      winning square, the returns can be significantly amplified beyond the standard ~24x multiplier.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-400 mb-2 text-base">Theory Being Tested:</h4>
                    <p className="text-slate-400 leading-relaxed">
                      This tool tests whether the Martingale strategy is profitable in the ORE mining context. The theory 
                      assumes that wins will eventually occur (even with only a 4% chance per round), but in practice, long 
                      losing streaks can require exponentially increasing bets that may exceed available capital.
                    </p>
                    <p className="text-slate-400 leading-relaxed mt-2">
                      The key difference from traditional Martingale: you're betting on a 1 in 25 chance (4%) rather than near-even 
                      odds, which means longer losing streaks are more likely, requiring more capital to sustain the strategy.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-400 mb-2 text-base">Key Risks:</h4>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-400 ml-2">
                      <li>Exponential bet growth during losing streaks (96% loss probability per round)</li>
                      <li>Requires significant capital to sustain long streaks</li>
                      <li>No guarantee of recovery - can lead to large losses</li>
                      <li>Lower win probability (4%) compared to traditional Martingale applications (~50%)</li>
                      <li>Longer losing streaks are statistically more likely</li>
                    </ul>
                  </div>
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-xs text-slate-500 leading-relaxed">
                      This simulation uses real ORE round data to track actual performance. Results are for educational 
                      purposes and do not guarantee future outcomes. This is a thought experiment to explore the viability 
                      of applying Martingale principles to ORE mining.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error: {error}</p>
          </div>
        )}

        {/* Loading Indicator - Subtle, in corner */}
        {loading && (
          <div className="fixed bottom-4 right-4 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex items-center gap-2 shadow-lg z-50">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-sm text-slate-400">Updating...</span>
          </div>
        )}

        {/* Controls */}
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Initial Bet */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Initial Bet
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <SolanaLogo width={20} />
                </div>
                <input
                  type="number"
                  value={initialBet}
                  onChange={(e) => setInitialBet(parseFloat(e.target.value) || 0.1)}
                  min="0.01"
                  step="0.01"
                  disabled={isRunning}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all"
                  placeholder="0.1"
                />
              </div>
            </div>

            {/* Selected Square */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Selected Square
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <input
                  type="number"
                  value={selectedSquare}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(25, parseInt(e.target.value) || 1));
                    setSelectedSquare(val);
                  }}
                  min="1"
                  max="25"
                  disabled={isRunning}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all"
                  placeholder="1-25"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">Choose square 1-25</p>
            </div>

            {/* Max Rounds */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Max Rounds
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <input
                  type="number"
                  value={maxRounds}
                  onChange={(e) => setMaxRounds(parseInt(e.target.value) || 0)}
                  min="0"
                  max="10000"
                  disabled={isRunning}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 transition-all"
                  placeholder="100"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">0 = unlimited</p>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleStart}
              disabled={isRunning || (maxRounds > 0 && rounds.length >= maxRounds)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Tracking
            </button>
            <button
              onClick={handlePause}
              disabled={!isRunning}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Pause
            </button>
            <button
              onClick={handleStep}
              disabled={isRunning}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Check Now
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Statistics - Moved to GridVisualization */}
        {false && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total SOL Deployed */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Total SOL Deployed</p>
            <div className="flex items-center gap-2">
              <SolanaLogo width={20} />
              <p className="text-2xl font-bold text-slate-100">{formatSol(stats.totalSolDeployed)}</p>
            </div>
          </div>

          {/* Total ORE Earned */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Total ORE Earned</p>
            <div className="flex items-center gap-2">
              <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 rounded" />
              <p className="text-2xl font-bold text-amber-400">{formatOre(stats.totalOreEarned)}</p>
            </div>
          </div>

          {/* Net Profit/Loss */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Net Profit/Loss</p>
            <div className="flex items-center gap-2">
              <SolanaLogo width={20} />
              <p className={`text-2xl font-bold ${stats.totalNetProfitSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalNetProfitSol >= 0 ? '+' : ''}{formatSol(stats.totalNetProfitSol)}
              </p>
            </div>
          </div>

          {/* Win Rate */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Win Rate</p>
            <p className="text-2xl font-bold text-slate-100">{stats.winRate.toFixed(2)}%</p>
            <p className="text-xs text-slate-500 mt-1">{stats.wins}W / {stats.losses}L</p>
          </div>

          {/* Current Bet */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Current Bet</p>
            <div className="flex items-center gap-2">
              <SolanaLogo width={20} />
              <p className="text-2xl font-bold text-slate-100">{formatSol(stats.currentBet)}</p>
            </div>
          </div>

          {/* Max Bet Placed */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Max Bet Placed</p>
            <div className="flex items-center gap-2">
              <SolanaLogo width={20} />
              <p className="text-2xl font-bold text-slate-100">{formatSol(stats.maxBetPlaced)}</p>
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Max Drawdown</p>
            <div className="flex items-center gap-2">
              <SolanaLogo width={20} />
              <p className="text-2xl font-bold text-red-400">{formatSol(stats.maxDrawdownSol)}</p>
            </div>
          </div>

          {/* Current Loss Streak */}
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <p className="text-sm text-slate-400 mb-2">Current Loss Streak</p>
            <p className="text-2xl font-bold text-red-400">{stats.currentLossStreak}</p>
            <p className="text-xs text-slate-500 mt-1">Longest: {stats.longestLossStreak}</p>
          </div>
        </div>
        )}

        {/* Grid Visualization - Show real current round */}
        {realState && realBids && realState.round && (
          <div className="mb-6">
            <GridVisualization
              perSquare={realState.round.perSquare || null}
              winningSquareIndex={
                realState.roundResult?.winningSquareIndex !== undefined
                  ? realState.roundResult.winningSquareIndex
                  : realState.roundResult?.winningSquareLabel
                    ? parseInt(realState.roundResult.winningSquareLabel.replace('#', '')) - 1
                    : null
              }
              countdown={countdown}
              uniqueMiners={parseInt(realState.round.uniqueMiners || '0')}
              totalBids={realBids.bids.reduce((sum, bid) => sum + bid.count, 0)}
              roundId={realState.round.roundId}
              state={realState}
              bids={realBids}
              roundResult={realState.roundResult || null}
              roundStatus={realState.round.mining.status || 'idle'}
              selectedSquare={selectedSquare}
              currentBet={stats.currentBet}
              martingaleStats={stats}
            />
            {realState.roundResult?.resultAvailable && (
              <div className="mt-4 p-4 bg-slate-800 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400">
                  Last processed round: <span className="text-slate-200 font-semibold">{realState.roundResult.roundId}</span>
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  Winning square: <span className="text-green-400 font-semibold">{realState.roundResult.winningSquareLabel}</span>
                  {realState.roundResult.motherlodeHit && (
                    <span className="text-yellow-400 ml-2">⭐ Motherlode Hit!</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Round History */}
        {rounds.length > 0 && (
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold text-slate-100 mb-4">Round History</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-slate-700">
                    <th className="pb-2">Round</th>
                    <th className="pb-2">Bet (SOL)</th>
                    <th className="pb-2">Square</th>
                    <th className="pb-2">Winner</th>
                    <th className="pb-2">Result</th>
                    <th className="pb-2">Winnings (SOL)</th>
                    <th className="pb-2">ORE</th>
                    <th className="pb-2">Net Profit (SOL)</th>
                    <th className="pb-2">Cumulative (SOL)</th>
                  </tr>
                </thead>
                <tbody>
                  {rounds.slice(-50).reverse().map((round) => (
                    <tr key={round.roundNumber} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-2 text-slate-300">{round.roundNumber}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <SolanaLogo width={16} />
                          <span className="text-slate-300">{formatSol(round.betSol)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-slate-300">#{round.selectedSquare}</td>
                      <td className="py-2 text-slate-300">#{round.winningSquare}</td>
                      <td className="py-2">
                        {round.won ? (
                          <span className="text-green-400 font-semibold">WIN</span>
                        ) : (
                          <span className="text-red-400 font-semibold">LOSS</span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <SolanaLogo width={16} />
                          <span className="text-slate-300">{formatSol(round.winningsSol)}</span>
                        </div>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1.5">
                          <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 rounded" />
                          <span className="text-amber-400">{formatOre(round.oreEarned)}</span>
                          {round.motherlodeHit && (
                            <span className="text-xs text-yellow-400" title="Motherlode Hit!">
                              ⭐
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`py-2 font-semibold ${round.netProfitSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <div className="flex items-center gap-1.5">
                          <SolanaLogo width={16} />
                          <span>{round.netProfitSol >= 0 ? '+' : ''}{formatSol(round.netProfitSol)}</span>
                        </div>
                      </td>
                      <td className={`py-2 font-semibold ${round.cumulativeNetProfitSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        <div className="flex items-center gap-1.5">
                          <SolanaLogo width={16} />
                          <span>{round.cumulativeNetProfitSol >= 0 ? '+' : ''}{formatSol(round.cumulativeNetProfitSol)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rounds.length > 50 && (
              <p className="text-xs text-slate-500 mt-4 text-center">
                Showing last 50 rounds. Total rounds tracked: {rounds.length}
              </p>
            )}
            {rounds.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8">
                No rounds tracked yet. Start tracking to see round history. Rounds will be recorded as they complete on the ORE network.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

