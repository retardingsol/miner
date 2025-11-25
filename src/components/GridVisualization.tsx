import { useState, useEffect, useRef, useMemo } from 'react';
import type { RoundPerSquare, StateResponse, BidsResponse } from '../types/api';
import { SolanaLogo } from './SolanaLogo';
import { AutoMinePanel } from './AutoMinePanel';

// Tooltip component that follows the mouse
function MouseTooltip({ children, content, enabled = true }: { children: React.ReactNode; content: React.ReactNode; enabled?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isPositioned, setIsPositioned] = useState(false);

  const calculatePosition = (clientX: number, clientY: number, useActualDimensions: boolean = false): { x: number; y: number } => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Offset from cursor
    const offsetX = 15;
    const offsetY = 15;
    
    let x = clientX + offsetX;
    let y = clientY + offsetY;
    
    // Get tooltip dimensions if available and we want to use them
    if (useActualDimensions) {
      const tooltip = tooltipRef.current;
      if (tooltip) {
        const tooltipRect = tooltip.getBoundingClientRect();
        
        // Adjust if tooltip would go off right edge
        if (x + tooltipRect.width > viewportWidth) {
          x = clientX - tooltipRect.width - offsetX;
        }
        
        // Adjust if tooltip would go off bottom edge
        if (y + tooltipRect.height > viewportHeight) {
          y = clientY - tooltipRect.height - offsetY;
        }
      }
    } else {
      // Use conservative estimates to avoid layout shift
      // Estimate: 300px width, 200px height
      if (x + 300 > viewportWidth) {
        x = clientX - 300 - offsetX;
      }
      
      if (y + 200 > viewportHeight) {
        y = clientY - 200 - offsetY;
      }
    }
    
    // Ensure tooltip doesn't go off left or top edges
    x = Math.max(10, x);
    y = Math.max(10, y);
    
    return { x, y };
  };

  // Recalculate position after tooltip is rendered with actual dimensions
  useEffect(() => {
    if (isVisible && position && tooltipRef.current && !isPositioned) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (tooltipRef.current && position) {
          // Recalculate with actual dimensions
          const rect = tooltipRef.current.getBoundingClientRect();
          const currentX = parseFloat(tooltipRef.current.style.left);
          const currentY = parseFloat(tooltipRef.current.style.top);
          
          // Only adjust if needed (if tooltip would overflow)
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          let x = currentX;
          let y = currentY;
          
          if (x + rect.width > viewportWidth) {
            x = Math.max(10, viewportWidth - rect.width - 10);
          }
          
          if (y + rect.height > viewportHeight) {
            y = Math.max(10, viewportHeight - rect.height - 10);
          }
          
          if (x !== currentX || y !== currentY) {
            setPosition({ x, y });
          }
          
          setIsPositioned(true);
        }
      });
    }
  }, [isVisible, position, isPositioned]);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (enabled) {
      // Calculate initial position immediately with estimated dimensions
      const initialPosition = calculatePosition(e.clientX, e.clientY, false);
      setPosition(initialPosition);
      setIsPositioned(false);
      setIsVisible(true);
    }
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
    setPosition(null);
    setIsPositioned(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!enabled || !isVisible) return;
    
    // Calculate position - use actual dimensions if tooltip is already positioned
    const newPosition = calculatePosition(e.clientX, e.clientY, isPositioned);
    setPosition(newPosition);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {children}
      {isVisible && enabled && position && position.x > 0 && position.y > 0 && (
        <div
          ref={tooltipRef}
          className="fixed bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-xl z-50 pointer-events-none"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            maxWidth: '320px',
            visibility: position.x > 0 && position.y > 0 ? 'visible' : 'hidden',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}


interface MartingaleStats {
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

interface GridVisualizationProps {
  perSquare: RoundPerSquare | null;
  winningSquareIndex?: number | null;
  countdown?: string;
  uniqueMiners?: number;
  totalBids?: number;
  roundId?: string;
  state: StateResponse | null;
  bids: BidsResponse | null;
  roundResult: StateResponse['roundResult'];
  roundStatus?: 'idle' | 'active' | 'finished' | 'expired';
  selectedSquare?: number | null; // 1-25 for Martingale strategy
  currentBet?: number | null; // Current bet amount in SOL for selected square
  martingaleStats?: MartingaleStats | null; // Stats for Martingale strategy
  userBets?: number[] | null; // Array of 25 SOL amounts (0-24 index) for user's bets on each square
  roundResults?: {
    roundId: string;
    solWon: number;
    oreWon: number;
  } | null; // Results from the last completed round
  walletAddress?: string | null;
}

export function GridVisualization({ perSquare, winningSquareIndex, countdown, uniqueMiners, totalBids, roundId, state, roundResult, roundStatus, selectedSquare, currentBet, martingaleStats, userBets, roundResults, walletAddress }: GridVisualizationProps) {
  const [barWidths, setBarWidths] = useState<number[]>(Array(25).fill(0));
  const [barColors, setBarColors] = useState<string[]>(Array(25).fill('bg-slate-500'));
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);

  const winningMiners = useMemo(() => {
    const list: {
      authority: string;
      solWon: number;
      oreWon: number;
      isUser: boolean;
    }[] = [];

    if (roundResult?.winners && Array.isArray(roundResult.winners)) {
      for (const w of roundResult.winners) {
        const authority = w.authority || '';
        if (!authority) continue;
        const sol = parseFloat(w.solWon ?? '0') || 0;
        const ore = parseFloat(w.oreWon ?? '0') || 0;
        list.push({
          authority,
          solWon: sol,
          oreWon: ore,
          isUser: walletAddress ? authority === walletAddress : false,
        });
      }
    }

    if (walletAddress && roundResults && (roundResults.solWon > 0 || roundResults.oreWon > 0)) {
      const existingIdx = list.findIndex((w) => w.authority === walletAddress);
      if (existingIdx >= 0) {
        list[existingIdx].solWon = roundResults.solWon;
        list[existingIdx].oreWon = roundResults.oreWon;
        list[existingIdx].isUser = true;
      } else {
        list.unshift({
          authority: walletAddress,
          solWon: roundResults.solWon,
          oreWon: roundResults.oreWon,
          isUser: true,
        });
      }
    }

    return list.sort((a, b) => {
      if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
      if (b.oreWon !== a.oreWon) return b.oreWon - a.oreWon;
      return b.solWon - a.solWon;
    });
  }, [roundResult?.winners, walletAddress, roundResults]);

  useEffect(() => {
    if (!perSquare) return;

    // Calculate average SOL deployed
    const avgDeployed = perSquare.deployedSol.reduce((sum, d) => sum + parseFloat(d || '0'), 0) / 25;
    
    // Find min and max for normalization
    const deployedValues = perSquare.deployedSol.map(d => parseFloat(d || '0'));
    const minDeployed = Math.min(...deployedValues);
    const maxDeployed = Math.max(...deployedValues);
    const range = maxDeployed - minDeployed || 1; // Avoid division by zero

    // Calculate standard deviation for "middle" range
    const variance = deployedValues.reduce((sum, val) => sum + Math.pow(val - avgDeployed, 2), 0) / 25;
    const stdDev = Math.sqrt(variance);
    const threshold = stdDev * 0.5; // Use 0.5 standard deviations as threshold for "middle"

    // Calculate new widths and colors with smooth animation
    const newWidths: number[] = [];
    const newColors: string[] = [];

    deployedValues.forEach((deployed) => {
      // Calculate fill percentage based on position in range (0-100%)
      const fillPercentage = range > 0 
        ? ((deployed - minDeployed) / range) * 100 
        : 50; // Default to 50% if all values are the same
      
      newWidths.push(Math.max(0, Math.min(100, fillPercentage)));
      
      // Color coding:
      // Green = above average (higher values)
      // Yellow = near average (middle values)
      // Red = below average (lower values)
      const diffFromAvg = deployed - avgDeployed;
      if (Math.abs(diffFromAvg) <= threshold) {
        // Near average - yellow
        newColors.push('bg-yellow-500');
      } else if (diffFromAvg > 0) {
        // Above average - green
        newColors.push('bg-green-500');
      } else {
        // Below average - red
        newColors.push('bg-red-500');
      }
    });

    // Animate the bars filling up
    setBarWidths(newWidths);
    setBarColors(newColors);
  }, [perSquare]);

  if (!perSquare) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-slate-300">Grid Visualization</h2>
        <p className="text-slate-500">No grid data available</p>
      </div>
    );
  }

  // Calculate average SOL deployed for display
  const avgDeployed = perSquare.deployedSol.reduce((sum, d) => sum + parseFloat(d || '0'), 0) / 25;

  // Calculate summary card values
  const motherlodeOre = state?.treasury?.motherlodeFormatted || '0';
  const solPrice = state?.solPrice ? parseFloat(state.solPrice.priceUsdRaw) : 0;
  
  const motherlodeAmount = parseFloat(motherlodeOre.replace(/[^\d.]/g, '')) || 0;
  
  const totalDeployedSol = state?.round?.totals.deployedSol 
    ? parseFloat(state.round.totals.deployedSol) 
    : 0;
  const totalDeployedUsd = totalDeployedSol * solPrice;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left side - Grid (fixed size) */}
        <div className="flex-shrink-0 w-full lg:w-auto">
          <div className="w-full grid grid-cols-5 gap-1.5 sm:gap-2 lg:inline-grid lg:max-w-fit lg:gap-4">
            {Array.from({ length: 25 }).map((_, index) => {
              const count = parseFloat(perSquare.counts[index] || '0');
              const deployed = parseFloat(perSquare.deployedSol[index] || '0');

                // Only show winning square when round is finished/expired (waiting for next round)
                const showWinningSquare = (roundStatus === 'expired' || roundStatus === 'finished') && roundResult?.resultAvailable;
                const isWinningSquare = showWinningSquare && 
                  (winningSquareIndex === index || 
                   (roundResult.winningSquareIndex !== undefined && roundResult.winningSquareIndex === index) ||
                   (roundResult.winningSquareLabel && parseInt(roundResult.winningSquareLabel.replace('#', '')) - 1 === index));
                
                // Check if this is the selected square for Martingale strategy (convert from 1-25 to 0-24 index)
                const isSelectedSquare = selectedSquare !== null && selectedSquare !== undefined && (selectedSquare - 1) === index;
                
                // Check if user has bet on this square (only show if there's a meaningful amount)
                const userBetAmount = userBets && userBets[index] > 0 ? userBets[index] : 0;
                const MIN_DISPLAY_THRESHOLD = 0.0001; // Only show if above threshold
                const hasUserBet = userBetAmount >= MIN_DISPLAY_THRESHOLD;
                
                // Highlight if user bet on it (yellow border similar to ore.supply)
                // Only highlight if it's a confirmed bet (not just UI state)
                const isUserBetSquare = hasUserBet && !isWinningSquare && userBets !== null;

                const showWinningStats = isWinningSquare && (roundStatus === 'expired' || roundStatus === 'finished') && roundResult?.resultAvailable;
                
                const winningStatsContent = showWinningStats && roundResult ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-3">
                      <svg className="w-3.5 h-3.5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs text-green-400 uppercase tracking-wider font-semibold">Winning Stats</p>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Winning Square</p>
                        <p className="text-lg font-bold text-green-400">{roundResult.winningSquareLabel}</p>
                      </div>
                      {roundResult.motherlodeHit && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Motherlode Hit</p>
                          <p className="text-lg font-bold text-amber-400">{roundResult.motherlodeFormatted}</p>
                        </div>
                      )}
                      {(roundResult.individualWinner || roundResult.individualWinnerAddress) && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Individual Winner (+1 ORE)</p>
                          <p className="text-sm font-semibold text-green-400">
                            {roundResult.individualWinner || 
                             (roundResult.individualWinnerAddress 
                               ? `${roundResult.individualWinnerAddress.slice(0, 4)}...${roundResult.individualWinnerAddress.slice(-4)}`
                               : 'N/A')}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Total Winnings</p>
                        <p className="text-lg font-bold text-slate-200">
                          {parseFloat(roundResult.totalWinningsSol).toFixed(2)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Total Deployed</p>
                        <p className="text-sm font-semibold text-slate-300">
                          {parseFloat(roundResult.totalDeployedSol).toFixed(2)} SOL
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Total Vaulted</p>
                        <p className="text-sm font-semibold text-slate-300">
                          {parseFloat(roundResult.totalVaultedSol).toFixed(2)} SOL
                        </p>
                      </div>
                    </div>
                  </>
                ) : null;
                
                return (
                  <MouseTooltip
                    key={index}
                    enabled={tooltipsEnabled && !!showWinningStats}
                    content={winningStatsContent || <></>}
                  >
                    <div
                      className={`rounded-lg border p-1.5 sm:p-2 lg:p-3 relative aspect-square flex flex-col w-full lg:w-20 xl:w-28 transition-all ${
                        isWinningSquare 
                          ? 'bg-green-900/30 border-green-500 ring-2 ring-green-500/50' 
                          : isSelectedSquare
                          ? 'bg-amber-900/20 border-amber-500 ring-2 ring-amber-500/50'
                          : isUserBetSquare
                          ? 'bg-amber-900/20 border-amber-500 ring-2 ring-amber-500/50'
                          : 'bg-[#202a3e] border-slate-600/50'
                      } ${showWinningStats && tooltipsEnabled ? 'cursor-help' : ''}`}
                    >
                      {/* Square number and miners count on same line at top */}
                      <div className="flex items-center justify-between mb-auto relative">
                        <p className="text-[10px] sm:text-xs lg:text-sm text-slate-400 font-medium">
                          #{index + 1}
                        </p>
                        <div className="flex items-center gap-0.5 sm:gap-1 flex-1 justify-end pr-0.5">
                          <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                          </svg>
                          <p className="text-[10px] sm:text-xs lg:text-sm font-bold text-slate-200">
                            {count.toLocaleString()}
                          </p>
                        </div>
                        {/* Current Bet for Selected Square - positioned below miner count */}
                        {isSelectedSquare && !isWinningSquare && currentBet !== null && currentBet !== undefined && currentBet > 0 && (
                          <div className="absolute top-full right-0 mt-0.5 flex items-center gap-0.5 sm:gap-1 bg-amber-500/20 border border-amber-500/50 rounded px-1 sm:px-1.5 py-0.5 z-10">
                            <SolanaLogo width={8} className="sm:w-2.5" />
                            <p className="text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-amber-400">
                              {currentBet.toFixed(3)}
                            </p>
                          </div>
                        )}
                        {/* User Bet Amount for this square - only show confirmed on-chain bets */}
                        {!isSelectedSquare && !isWinningSquare && hasUserBet && userBets !== null && (
                          <div className="absolute top-full right-0 mt-0.5 flex items-center gap-0.5 sm:gap-1 bg-amber-500/20 border border-amber-500/50 rounded px-1 sm:px-1.5 py-0.5 z-10">
                            <SolanaLogo width={8} className="sm:w-2.5" />
                            <p className="text-[8px] sm:text-[9px] lg:text-[10px] font-bold text-amber-400">
                              {userBetAmount.toFixed(4)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* SOL value with icon - bottom right */}
                      <div className="absolute bottom-2 sm:bottom-3 lg:bottom-4 right-1.5 sm:right-2 lg:right-3 flex items-center gap-0.5 sm:gap-1">
                        <div className="hidden lg:block">
                          <SolanaLogo width={14} />
                        </div>
                        <div className="lg:hidden">
                          <SolanaLogo width={10} />
                        </div>
                        <p className="text-[10px] sm:text-xs lg:text-sm font-bold text-slate-100">
                          {deployed.toFixed(2)}
                        </p>
                      </div>

                      {/* Animated indicator bar at bottom */}
                      {tooltipsEnabled && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700/50 rounded-b-lg overflow-hidden">
                          <div
                            className={`h-full ${barColors[index]} transition-all duration-1000 ease-out`}
                            style={{
                              width: `${barWidths[index]}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </MouseTooltip>
                );
            })}
          </div>

          {/* Color Coding Help Icon and Tooltip Toggle - below grid */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="relative group">
              <MouseTooltip
                enabled={tooltipsEnabled}
                content={
                  <>
                    <p className="text-xs text-slate-300 mb-2 font-semibold">Color Coding:</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded mt-0.5 flex-shrink-0" />
                        <span className="text-slate-300">Above average activity</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded mt-0.5 flex-shrink-0" />
                        <span className="text-slate-300">Near average activity (within 0.5 std dev)</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded mt-0.5 flex-shrink-0" />
                        <span className="text-slate-300">Below average activity</span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      The indicator bar at the bottom of each square shows the relative activity level compared to the average across all squares.
                    </p>
                  </>
                }
              >
                <button
                  type="button"
                  onClick={() => {}} // Always clickable, shows tooltip when enabled
                  className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-xs text-slate-400">Color coding</span>
                </button>
              </MouseTooltip>
            </div>

            {/* Tooltip Toggle Switch */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Tooltips</span>
              <button
                onClick={() => setTooltipsEnabled(!tooltipsEnabled)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${
                  tooltipsEnabled ? 'bg-green-600' : 'bg-slate-600'
                }`}
                aria-label="Toggle tooltips"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tooltipsEnabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Stats, Summary Cards */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="space-y-3 flex-1">
          {/* Stats in 2 rows: 3 cards per row on large screens */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2 sm:gap-3">
            {/* ORE Mining # */}
            {roundId && (
              <MouseTooltip
                enabled={tooltipsEnabled}
                content={
                  <>
                    <p className="text-xs text-slate-300 mb-2 font-semibold">Current Round</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This is the current ORE mining round ID. Each round represents a complete mining cycle where miners place bids on grid squares. The round ends when the countdown reaches zero, and a winning square is selected.
                    </p>
                  </>
                }
              >
                <div className={`bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col lg:col-span-2 ${tooltipsEnabled ? 'cursor-help' : ''}`}>
                  <div className="flex items-center gap-1 sm:gap-1.5 mb-1 min-w-0">
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate">Round</p>
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-slate-200">#{roundId}</p>
                </div>
              </MouseTooltip>
            )}

            {/* Countdown */}
            {countdown && (
              <MouseTooltip
                enabled={tooltipsEnabled}
                content={
                  <>
                    <p className="text-xs text-slate-300 mb-2 font-semibold">Round Countdown</p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Time remaining until the current round ends. When the countdown reaches zero, the winning square is selected and rewards are distributed. After a brief period, a new round begins.
                    </p>
                    {state?.round?.mining?.status && (
                      <p className="text-xs text-slate-400 mt-2">
                        Status: <span className="text-slate-300 capitalize">{state.round.mining.status}</span>
                      </p>
                    )}
                  </>
                }
              >
                <div className={`bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col ${tooltipsEnabled ? 'cursor-help' : ''}`}>
                  <div className="flex items-center gap-1 sm:gap-1.5 mb-1 min-w-0">
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate">Countdown</p>
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-slate-200">{countdown}</p>
                </div>
              </MouseTooltip>
            )}

            {/* MOTHERLODE (first row) */}
            <MouseTooltip
              enabled={tooltipsEnabled}
              content={
                <>
                  <p className="text-xs text-slate-300 mb-2 font-semibold">Motherlode</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Each round, +0.2 ORE is minted and added to the motherlode pool. When the winning block is revealed, there is a 1 in 625 chance that those winning miners will also hit the motherlode. If the motherlode is hit, the pool is split by the winning miners in proportion to the size of their claimed space on the winning block. Alternatively, if the motherlode is not hit, the pool keeps accumulating and will be distributed to winning miners when it is hit in a future round.
                  </p>
                </>
              }
            >
              <div className={`bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col ${tooltipsEnabled ? 'cursor-help' : ''}`}>
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1 min-w-0">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate break-words">MOTHERLODE</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <img 
                    src="/orelogo.jpg" 
                    alt="ORE" 
                    className="w-5 h-5 sm:w-6 sm:h-6 object-contain rounded-lg flex-shrink-0"
                  />
                  <span className="text-base sm:text-lg font-bold text-amber-400">
                    {motherlodeAmount.toFixed(1)}
                  </span>
                </div>
              </div>
            </MouseTooltip>

            {/* Average (first row) */}
            <MouseTooltip
              enabled={tooltipsEnabled}
              content={
                <>
                  <p className="text-xs text-slate-300 mb-2 font-semibold">Average Deployed SOL</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Average amount of SOL deployed per square in the grid. Calculated as Total Deployed SOL divided by 25 (the number of squares).
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Formula: Total Deployed SOL ÷ 25 squares
                  </p>
                </>
              }
            >
              <div className={`bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col ${tooltipsEnabled ? 'cursor-help' : ''}`}>
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1 min-w-0">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate">Average</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <SolanaLogo width={16} className="sm:w-[18px] flex-shrink-0" />
                  <p className="text-base sm:text-lg font-semibold text-slate-200">{avgDeployed.toFixed(2)}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{formatCurrency(avgDeployed * solPrice)}</p>
              </div>
            </MouseTooltip>
            
            {/* TOTAL SOL (first row) */}
            <MouseTooltip
              enabled={tooltipsEnabled}
              content={
                <>
                  <p className="text-xs text-slate-300 mb-2 font-semibold">Total SOL</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Total amount of SOL that has been deployed (bid) across all 25 squares in the current round. This is the sum of all miner bids placed on the grid.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    This value is used in the Production Cost calculation and affects the breakeven price in the EV calculation.
                  </p>
                  {avgDeployed > 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      Average per square: {avgDeployed.toFixed(2)} SOL
                    </p>
                  )}
                </>
              }
            >
              <div className={`bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col ${tooltipsEnabled ? 'cursor-help' : ''}`}>
                <div className="flex items-center gap-1 sm:gap-1.5 mb-1 min-w-0">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate break-words">TOTAL SOL</p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <SolanaLogo width={20} className="sm:w-6 flex-shrink-0" />
                  <span className="text-base sm:text-lg font-bold text-slate-100">
                    {totalDeployedSol.toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{formatCurrency(totalDeployedUsd)}</p>
              </div>
            </MouseTooltip>

            {/* Miners (second row) */}
            {uniqueMiners !== undefined && (
              <MouseTooltip
                enabled={tooltipsEnabled}
                content={
                  <>
                    <p className="text-xs text-slate-300 mb-2 font-semibold">Mining Participants</p>
                    <p className="text-xs text-slate-400 leading-relaxed mb-2">
                      Number of unique miners participating in the current round.
                    </p>
                    {totalBids !== undefined && (
                      <div className="mt-2 pt-2 border-t border-slate-700">
                        <p className="text-xs text-slate-300 mb-1">Total Bids: <span className="font-semibold">{totalBids.toLocaleString()}</span></p>
                        <p className="text-xs text-slate-400">
                          Average bids per miner: {uniqueMiners > 0 ? (totalBids / uniqueMiners).toFixed(1) : '0'}
                        </p>
                      </div>
                    )}
                  </>
                }
              >
                <div className={`bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700 hover:border-slate-600 transition-colors h-full flex flex-col ${tooltipsEnabled ? 'cursor-help' : ''}`}>
                  <div className="flex items-center gap-1 sm:gap-1.5 mb-1 min-w-0">
                    <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <p className="text-[10px] sm:text-xs text-slate-400 uppercase tracking-wider truncate">Miners</p>
                  </div>
                  <p className="text-base sm:text-lg font-semibold text-slate-200">{uniqueMiners.toLocaleString()}</p>
                  {totalBids !== undefined && (
                    <p className="text-[10px] sm:text-xs text-slate-400 mt-1">{totalBids.toLocaleString()} bids</p>
                  )}
                </div>
              </MouseTooltip>
            )}

            {/* EXPECTED VALUE CALCULATOR temporarily hidden */}
          </div>

          {/* Round Results Display - Shows SOL and ORE won after round ends */}
          {roundResults && (
            <div className="mb-3 p-3 bg-green-900/30 border border-green-500 rounded-lg animate-pulse">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm font-semibold text-green-400">Round #{roundResults.roundId} Results</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {roundResults.solWon > 0 && (
                  <div className="flex items-center gap-2">
                    <SolanaLogo width={20} height={20} />
                    <div>
                      <p className="text-xs text-slate-400">SOL Won</p>
                      <p className="text-lg font-bold text-green-400">{roundResults.solWon.toFixed(4)}</p>
                    </div>
                  </div>
                )}
                {roundResults.oreWon > 0 && (
                  <div className="flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" />
                    <div>
                      <p className="text-xs text-slate-400">ORE Won</p>
                      <p className="text-lg font-bold text-amber-400">{roundResults.oreWon.toFixed(4)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Winning miners list for the last finalized round */}
          {winningMiners.length > 0 && (
            <div className="mb-3 bg-[#111827] border border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13 7a3 3 0 11-6 0 3 3 0 016 0zM5 14a4 4 0 118 0H5z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                    Miners
                  </p>
                </div>
                {roundResults && (
                  <p className="text-[10px] text-slate-500">
                    Round #{roundResults.roundId}
                  </p>
                )}
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {winningMiners.map((m) => {
                  const short =
                    m.authority.length > 8
                      ? `${m.authority.slice(0, 4)}...${m.authority.slice(-4)}`
                      : m.authority;
                  return (
                    <div
                      key={m.authority}
                      className={`flex items-center justify-between px-2 py-1 rounded-lg ${
                        m.isUser ? 'bg-amber-500/10 border border-amber-400/40' : 'bg-slate-800/40'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span
                          className={`text-xs font-medium ${
                            m.isUser ? 'text-amber-200' : 'text-slate-200'
                          }`}
                        >
                          {m.isUser ? 'You' : short}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <SolanaLogo width={12} height={12} />
                          <span className="text-slate-100 font-semibold">
                            {m.solWon.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <img
                            src="/orelogo.jpg"
                            alt="ORE"
                            className="w-3 h-3 object-contain rounded"
                          />
                          <span className="text-amber-300 font-semibold">
                            {m.oreWon.toFixed(6)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Auto-mine configuration - directly below the two stats rows */}
          <div className="mb-3">
            <AutoMinePanel />
          </div>

          {/* Martingale Stats */}
          {martingaleStats ? (
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Total SOL Deployed */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Total SOL Deployed</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <SolanaLogo width={16} className="sm:w-5" />
                  <p className="text-base sm:text-xl font-bold text-slate-100">{martingaleStats.totalSolDeployed.toFixed(4)}</p>
                </div>
              </div>

              {/* Total ORE Earned */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Total ORE Earned</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 sm:w-5 sm:h-5 rounded" />
                  <p className="text-base sm:text-xl font-bold text-amber-400">{martingaleStats.totalOreEarned.toFixed(4)}</p>
                </div>
              </div>

              {/* Net Profit/Loss */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Net Profit/Loss</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <SolanaLogo width={16} className="sm:w-5" />
                  <p className={`text-base sm:text-xl font-bold ${martingaleStats.totalNetProfitSol >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {martingaleStats.totalNetProfitSol >= 0 ? '+' : ''}{martingaleStats.totalNetProfitSol.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Win Rate */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Win Rate</p>
                <p className="text-base sm:text-xl font-bold text-slate-100">{martingaleStats.winRate.toFixed(2)}%</p>
                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5">{martingaleStats.wins}W / {martingaleStats.losses}L</p>
              </div>

              {/* Current Bet */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Current Bet</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <SolanaLogo width={16} className="sm:w-5" />
                  <p className="text-base sm:text-xl font-bold text-slate-100">{martingaleStats.currentBet.toFixed(4)}</p>
                </div>
              </div>

              {/* Max Bet Placed */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Max Bet Placed</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <SolanaLogo width={16} className="sm:w-5" />
                  <p className="text-base sm:text-xl font-bold text-slate-100">{martingaleStats.maxBetPlaced.toFixed(4)}</p>
                </div>
              </div>

              {/* Max Drawdown */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Max Drawdown</p>
                <div className="flex items-center gap-1 sm:gap-2">
                  <SolanaLogo width={16} className="sm:w-5" />
                  <p className="text-base sm:text-xl font-bold text-red-400">{martingaleStats.maxDrawdownSol.toFixed(4)}</p>
                </div>
              </div>

              {/* Current Loss Streak */}
              <div className="bg-[#21252C] rounded-lg p-2 sm:p-3 border border-slate-700">
                <p className="text-[10px] sm:text-xs text-slate-400 mb-1 sm:mb-2">Current Loss Streak</p>
                <p className="text-base sm:text-xl font-bold text-red-400">{martingaleStats.currentLossStreak}</p>
                <p className="text-[9px] sm:text-xs text-slate-500 mt-0.5">Longest: {martingaleStats.longestLossStreak}</p>
              </div>
            </div>
          ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}