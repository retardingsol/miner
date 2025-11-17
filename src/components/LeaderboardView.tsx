import { useState, useEffect, useMemo } from 'react';
import { getLeaderboard, getOreLeaders } from '../services/api';
import { SolanaLogo } from './SolanaLogo';

interface LeaderboardEntry {
  pubkey: string;
  rounds_played: number;
  rounds_won: number;
  total_sol_deployed: number;
  total_sol_earned: number;
  total_ore_earned: number;
  unclaimed_ore?: number; // Only for ORE mode - unclaimed ORE from rewards_ore (unrefined)
  refined_ore?: number; // Only for ORE mode - refined ORE
  net_sol_change: number;
  sol_balance_direction: string;
  rank?: number;
}

const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11; // ORE values use 1e11 conversion factor

export function LeaderboardView() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'sol' | 'ore'>('ore');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setError(null);
        setLoading(true);
        
        if (displayMode === 'ore') {
          // Fetch ORE leaders from miners endpoint
          const minersData = await getOreLeaders();
          
          if (minersData && Array.isArray(minersData)) {
            // Map miners data to leaderboard entry format
            const mappedData: LeaderboardEntry[] = minersData.map((miner) => {
              // Convert SOL values from lamports
              const totalSolDeployed = miner.total_deployed / LAMPORTS_PER_SOL;
              const lifetimeSolEarned = miner.lifetime_rewards_sol / LAMPORTS_PER_SOL;
              
              // Calculate net SOL change (earned - deployed)
              const netSolChange = lifetimeSolEarned - totalSolDeployed;
              
              return {
                pubkey: miner.authority,
                rounds_played: 0, // Not available in miners endpoint
                rounds_won: 0, // Not available in miners endpoint
                total_sol_deployed: miner.total_deployed,
                total_sol_earned: miner.lifetime_rewards_sol,
                total_ore_earned: miner.lifetime_rewards_ore, // Lifetime ORE earned (already in smallest unit)
                unclaimed_ore: miner.rewards_ore, // Unrefined ORE (already in smallest unit)
                refined_ore: miner.refined_ore, // Refined ORE (already in smallest unit)
                net_sol_change: netSolChange * LAMPORTS_PER_SOL, // Convert back to lamports
                sol_balance_direction: netSolChange >= 0 ? 'up' : 'down',
              };
            });
            
            setLeaderboardData(mappedData);
          } else {
            setError('Invalid data format received');
            setLeaderboardData([]);
          }
        } else {
          // Fetch SOL leaders from leaderboard endpoint
          const data = await getLeaderboard();
          
          if (data && Array.isArray(data)) {
            setLeaderboardData(data);
          } else {
            setError('Invalid data format received');
            setLeaderboardData([]);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch leaderboard data';
        setError(errorMessage);
        console.error('Error fetching leaderboard data:', err);
        setLeaderboardData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    // Refresh leaderboard data every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [displayMode]); // Re-fetch when display mode changes

  const formatSol = (value: number) => {
    // Convert from lamports to SOL
    const sol = value / LAMPORTS_PER_SOL;
    return sol.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatOre = (value: number) => {
    // ORE values are in smallest unit
    // Convert from smallest unit to ORE using the conversion factor
    const oreValue = value / ORE_CONVERSION_FACTOR;
    // Format with 2 decimal places
    return oreValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Sort leaderboard data based on display mode
  // ORE mode: Data is already sorted by unclaimed_ore from the API
  // SOL mode: Sort by net_sol_change
  const sortedLeaderboardData = useMemo(() => {
    if (!leaderboardData.length) return [];
    
    if (displayMode === 'ore') {
      // For ORE mode, data is already sorted by unclaimed_ore from the API
      // Just return as-is (already sorted by rewards_ore which is unclaimed ORE)
      return leaderboardData;
    } else {
      // Sort by net SOL change (descending) - highest net SOL first
      return [...leaderboardData].sort((a, b) => {
        return b.net_sol_change - a.net_sol_change;
      });
    }
  }, [leaderboardData, displayMode]);

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Leaderboard</h1>
          <p className="text-slate-400 mb-4">
            {displayMode === 'sol' 
              ? 'Ranked by net SOL change (total SOL earned minus total SOL deployed). Shows all-time mining performance.'
              : 'Ranked by unrefined ORE. Shows miners with the highest unrefined ORE rewards waiting to be refined.'}
          </p>
          
          {/* Toggle Switch */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400">View by:</span>
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setDisplayMode('sol')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  displayMode === 'sol'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <SolanaLogo width={16} />
                SOL
              </button>
              <button
                onClick={() => setDisplayMode('ore')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  displayMode === 'ore'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <img 
                  src="/orelogo.jpg" 
                  alt="ORE" 
                  className="w-4 h-4 rounded"
                />
                ORE
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error loading data</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Leaderboard Table */}
        {loading ? (
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading Leaderboard data...</p>
          </div>
        ) : error ? (
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-red-400 font-semibold mb-2">Error: {error}</p>
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  if (displayMode === 'ore') {
                    const minersData = await getOreLeaders();
                    if (minersData && Array.isArray(minersData)) {
                      const mappedData: LeaderboardEntry[] = minersData.map((miner) => {
                        const totalSolDeployed = miner.total_deployed / LAMPORTS_PER_SOL;
                        const lifetimeSolEarned = miner.lifetime_rewards_sol / LAMPORTS_PER_SOL;
                        const netSolChange = lifetimeSolEarned - totalSolDeployed;
                        return {
                          pubkey: miner.authority,
                          rounds_played: 0,
                          rounds_won: 0,
                          total_sol_deployed: miner.total_deployed,
                          total_sol_earned: miner.lifetime_rewards_sol,
                          total_ore_earned: miner.lifetime_rewards_ore,
                          unclaimed_ore: miner.rewards_ore,
                          refined_ore: miner.refined_ore,
                          net_sol_change: netSolChange * LAMPORTS_PER_SOL,
                          sol_balance_direction: netSolChange >= 0 ? 'up' : 'down',
                        };
                      });
                      setLeaderboardData(mappedData);
                    }
                  } else {
                    const data = await getLeaderboard();
                    if (data && Array.isArray(data)) {
                      setLeaderboardData(data);
                    }
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to fetch');
                } finally {
                  setLoading(false);
                }
              }}
              className="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg border border-amber-500/50 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-slate-400">No leaderboard data available</p>
            <button
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  if (displayMode === 'ore') {
                    const minersData = await getOreLeaders();
                    if (minersData && Array.isArray(minersData)) {
                      const mappedData: LeaderboardEntry[] = minersData.map((miner) => {
                        const totalSolDeployed = miner.total_deployed / LAMPORTS_PER_SOL;
                        const lifetimeSolEarned = miner.lifetime_rewards_sol / LAMPORTS_PER_SOL;
                        const netSolChange = lifetimeSolEarned - totalSolDeployed;
                        return {
                          pubkey: miner.authority,
                          rounds_played: 0,
                          rounds_won: 0,
                          total_sol_deployed: miner.total_deployed,
                          total_sol_earned: miner.lifetime_rewards_sol,
                          total_ore_earned: miner.lifetime_rewards_ore,
                          unclaimed_ore: miner.rewards_ore,
                          refined_ore: miner.refined_ore,
                          net_sol_change: netSolChange * LAMPORTS_PER_SOL,
                          sol_balance_direction: netSolChange >= 0 ? 'up' : 'down',
                        };
                      });
                      setLeaderboardData(mappedData);
                    }
                  } else {
                    const data = await getLeaderboard();
                    if (data && Array.isArray(data)) {
                      setLeaderboardData(data);
                    }
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to fetch');
                } finally {
                  setLoading(false);
                }
              }}
              className="mt-4 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-lg border border-amber-500/50 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="bg-[#21252C] rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700">
                  <tr>
                    <th className="px-2 sm:px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-2 sm:px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Address
                    </th>
                    {/* Net SOL Change / Unrefined ORE - First after Address */}
                    <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {displayMode === 'sol' ? 'Net SOL Change' : 'Unrefined ORE'}
                      <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                        {displayMode === 'sol' 
                          ? 'Earned - Deployed' 
                          : 'ORE waiting to be refined'}
                      </div>
                    </th>
                    {displayMode === 'sol' && (
                      <>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                          Total SOL Earned
                          <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                            Lifetime SOL rewards
                          </div>
                        </th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                          Total SOL Deployed
                          <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                            Lifetime SOL deployed
                          </div>
                        </th>
                      </>
                    )}
                    {displayMode === 'ore' && (
                      <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Refined ORE
                        <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                          ORE that has been refined
                        </div>
                      </th>
                    )}
                    <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {displayMode === 'sol' ? 'ORE Earned' : 'Total ORE Earned'}
                      <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                        {displayMode === 'sol' 
                          ? 'Lifetime ORE rewards' 
                          : 'Unrefined + Refined'}
                      </div>
                    </th>
                    {displayMode === 'sol' && (
                      <>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                          Rounds Won
                          <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                            Total wins
                          </div>
                        </th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                          Rounds Played
                          <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                            Total rounds
                          </div>
                        </th>
                        <th className="px-2 sm:px-3 py-2 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                          Win Rate
                          <div className="text-[10px] font-normal normal-case mt-0.5 text-slate-500">
                            Win percentage
                          </div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {sortedLeaderboardData.map((entry, index) => {
                    const rank = index + 1;
                    const winRate = entry.rounds_played > 0 ? entry.rounds_won / entry.rounds_played : 0;
                    const netChange = entry.net_sol_change / LAMPORTS_PER_SOL;
                    
                    // For ORE mode, we need to get unclaimed ORE from the original data
                    // Since we're storing total_ore_earned, we'll use that for display
                    // The API returns rewards_ore which is unclaimed ORE
                    
                    return (
                      <tr
                        key={entry.pubkey || index}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-bold text-slate-300">#{rank}</span>
                            {rank === 1 && (
                              <span className="ml-1.5 text-yellow-400">👑</span>
                            )}
                          </div>
                        </td>
                        <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                          {displayMode === 'ore' ? (
                            <a
                              href={`https://solscan.io/account/${entry.pubkey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono text-slate-200 hover:text-amber-400 transition-colors"
                            >
                              {formatAddress(entry.pubkey)}
                            </a>
                          ) : (
                            <a
                              href={`https://solscan.io/account/${entry.pubkey}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-mono text-slate-200 hover:text-amber-400 transition-colors"
                            >
                              {formatAddress(entry.pubkey)}
                            </a>
                          )}
                        </td>
                        {/* Net SOL Change / Unrefined ORE - First after Address, only green */}
                        <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right">
                          {displayMode === 'sol' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <SolanaLogo width={16} />
                              <span className={`text-sm font-semibold ${
                                netChange >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {netChange >= 0 ? '+' : ''}{formatSol(entry.net_sol_change)}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5">
                              <img 
                                src="/orelogo.jpg" 
                                alt="ORE" 
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-sm font-semibold text-green-400">
                                {formatOre(entry.unclaimed_ore ?? 0)}
                              </span>
                              <span className="text-sm text-green-400 ml-1 hidden sm:inline">ORE</span>
                            </div>
                          )}
                        </td>
                        {displayMode === 'sol' && (
                          <>
                            <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right hidden sm:table-cell">
                              <div className="flex items-center justify-end gap-1.5">
                                <SolanaLogo width={16} />
                                <span className="text-sm font-semibold text-slate-200">
                                  {formatSol(entry.total_sol_earned)}
                                </span>
                              </div>
                            </td>
                            <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right hidden sm:table-cell">
                              <div className="flex items-center justify-end gap-1.5">
                                <SolanaLogo width={16} />
                                <span className="text-sm font-semibold text-slate-200">
                                  {formatSol(entry.total_sol_deployed)}
                                </span>
                              </div>
                            </td>
                          </>
                        )}
                        {/* Refined ORE - Only for ORE mode */}
                        {displayMode === 'ore' && (
                          <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <img 
                                src="/orelogo.jpg" 
                                alt="ORE" 
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-sm font-semibold text-slate-200">
                                {formatOre(entry.refined_ore ?? 0)}
                              </span>
                              <span className="text-sm text-slate-400 ml-1 hidden sm:inline">ORE</span>
                            </div>
                          </td>
                        )}
                        <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <img 
                              src="/orelogo.jpg" 
                              alt="ORE" 
                              className="w-4 h-4 rounded"
                            />
                            <span className="text-sm font-semibold text-slate-200">
                              {formatOre(entry.total_ore_earned)}
                            </span>
                            <span className="text-sm text-slate-400 ml-1 hidden sm:inline">ORE</span>
                          </div>
                        </td>
                        {displayMode === 'sol' && (
                          <>
                            <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right hidden md:table-cell">
                              <span className="text-sm font-semibold text-slate-200">
                                {entry.rounds_won.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right hidden lg:table-cell">
                              <span className="text-sm font-semibold text-slate-200">
                                {entry.rounds_played.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-2 sm:px-3 py-2 whitespace-nowrap text-right hidden lg:table-cell">
                              <span className="text-sm font-semibold text-slate-200">
                                {formatPercentage(winRate)}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

