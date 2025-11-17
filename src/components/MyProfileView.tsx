import { useState, useEffect, useCallback, memo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { getMinerStats, getWalletBalance, getLeaderboard, getMinerHistory, getTokenCurrent, getProfileData, getWalletBalances, getOreLeaders } from '../services/api';
import { SolanaLogo } from './SolanaLogo';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11;

// Loading indicator component - defined outside with memo to prevent re-creation on re-renders
const LoadingIndicator = memo(({ className = "" }: { className?: string }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <div 
      className="rounded-full h-4 w-4 border-b-2 border-slate-400"
      style={{
        animation: 'spin 1s linear infinite',
        willChange: 'transform',
        animationFillMode: 'both'
      }}
    ></div>
    <div 
      className="bg-slate-700 h-6 w-20 rounded"
      style={{
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        willChange: 'opacity',
        animationFillMode: 'both'
      }}
    ></div>
  </div>
));

LoadingIndicator.displayName = 'LoadingIndicator';

interface MinerStats {
  authority: string;
  deployed: number[];
  total_deployed: number;
  cumulative: number[];
  checkpoint_fee: number;
  checkpoint_id: number;
  last_claim_ore_at: number;
  last_claim_sol_at: number;
  rewards_sol: number;
  rewards_ore: number;
  refined_ore: number;
  round_id: number;
  lifetime_rewards_sol: number;
  lifetime_rewards_ore: number;
}

interface LeaderboardEntry {
  pubkey: string;
  rounds_played: number;
  rounds_won: number;
  total_sol_deployed: number;
  total_sol_earned: number;
  total_ore_earned: number;
  net_sol_change: number;
  sol_balance_direction: string;
}

interface HistoryDataPoint {
  timestamp: number;
  unclaimed_ore: number;
  refined_ore: number;
  lifetime_sol: number;
  lifetime_ore: number;
}

export function MyProfileView() {
  const { publicKey, connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const [minerStats, setMinerStats] = useState<MinerStats | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry | null>(null);
  const [oreLeaderboard, setOreLeaderboard] = useState<Array<{ authority: string; rewards_ore: number }>>([]);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [orePrice, setOrePrice] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [walletBalances, setWalletBalances] = useState<any>(null);
  const [profileDataLoading, setProfileDataLoading] = useState(false);
  const [minerStatsLoading, setMinerStatsLoading] = useState(false);
  const [leaderboardDataLoading, setLeaderboardDataLoading] = useState(false);
  const [oreLeaderboardLoading, setOreLeaderboardLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(true);

  // Helper to check if leaderboard rank is loading
  const isLeaderboardRankLoading = () => {
    return oreLeaderboardLoading || (loading && oreLeaderboard.length === 0);
  };

  const formatOre = (ore: number) => {
    const converted = ore / ORE_CONVERSION_FACTOR;
    return converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper function to perform wallet search (progressive loading - fast display)
  const performWalletSearch = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setMinerStats(null);
    setLeaderboardData(null);
    setOreLeaderboard([]);
    setHistoryData([]);
    setWalletBalance(null);
    setProfileData(null);
    setWalletBalances(null);
    setShowGraph(false);
    setProfileDataLoading(false);
    setMinerStatsLoading(false);
    setLeaderboardDataLoading(false);
    setOreLeaderboardLoading(false);

    const trimmedAddress = address.trim();
    let hasReceivedData = false;

    // Helper to stop loading once we have critical data
    const stopLoadingIfDataReceived = () => {
      if (!hasReceivedData) {
        hasReceivedData = true;
        setLoading(false);
      }
    };

    // Fetch wallet balances first (fast, most visible)
    getWalletBalances(trimmedAddress)
      .then((result) => {
        setWalletBalances(result);
      })
      .catch((err) => {
        console.error('Failed to fetch wallet balances:', err);
      });

    // Fetch profile data (core stats)
    setProfileDataLoading(true);
    getProfileData(trimmedAddress)
      .then((result) => {
        console.log('Profile data received:', result);
        setProfileData(result);
        setProfileDataLoading(false);
        stopLoadingIfDataReceived();
      })
      .catch((err) => {
        console.error('Failed to fetch profile data:', err);
        setProfileData(null);
        setProfileDataLoading(false);
      });

    // Fetch miner stats (fallback - important when profile fails)
    setMinerStatsLoading(true);
    getMinerStats(trimmedAddress)
      .then((result) => {
        console.log('Miner stats received:', result);
        setMinerStats(result);
        setMinerStatsLoading(false);
        stopLoadingIfDataReceived();
      })
      .catch((err) => {
        console.error('Failed to fetch miner stats:', err);
        setMinerStatsLoading(false);
      });

    // Fetch leaderboard data (fallback for rounds/wins)
    setLeaderboardDataLoading(true);
    getLeaderboard()
      .then((leaderboard) => {
        const minerEntry = leaderboard.find(entry => entry.pubkey === trimmedAddress);
        if (minerEntry) {
          setLeaderboardData(minerEntry);
        }
        setLeaderboardDataLoading(false);
        if (minerEntry) {
          stopLoadingIfDataReceived();
        }
      })
      .catch((err) => {
        console.error('Failed to fetch leaderboard data:', err);
        setLeaderboardDataLoading(false);
      });

    // Fetch wallet balance (non-critical)
    getWalletBalance(trimmedAddress)
      .then((result) => {
        setWalletBalance(result);
      })
      .catch(() => {
        setWalletBalance(null);
      });

    // Fetch miner history (non-critical, for graph)
    getMinerHistory(trimmedAddress)
      .then((result) => {
        setHistoryData(result);
      })
      .catch(() => {
        setHistoryData([]);
      });

    // Fetch ORE leaderboard (for rank)
    setOreLeaderboardLoading(true);
    getOreLeaders()
      .then((oreLeaders) => {
        const sortedOreLeaders = [...oreLeaders].sort((a, b) => b.rewards_ore - a.rewards_ore);
        setOreLeaderboard(sortedOreLeaders.map(leader => ({ authority: leader.authority, rewards_ore: leader.rewards_ore })));
        setOreLeaderboardLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch ORE leaderboard data:', err);
        setOreLeaderboardLoading(false);
      });

    // Fallback timeout - ensures loading stops even if all APIs fail
    setTimeout(() => {
      stopLoadingIfDataReceived();
    }, 3000);
  }, []);

  // Fetch SOL and ORE prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
      setPricesLoading(true);
            // Fetch SOL price from CoinGecko
            const solResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
            const solData = await solResponse.json();
            setSolPrice(solData.solana?.usd || null);

            // Fetch ORE price from token API
            try {
              const tokenData = await getTokenCurrent();
              console.log('Token data received:', tokenData);
              const orePriceValue = typeof tokenData.priceUsd === 'number' 
                ? tokenData.priceUsd 
                : (tokenData.priceUsd ? parseFloat(String(tokenData.priceUsd)) : null);
              console.log('ORE price value:', orePriceValue);
              setOrePrice(orePriceValue);
            } catch (tokenErr) {
              // ORE price fetch failed - continue without it, USD calculations will show 0
              console.error('Error fetching ORE price:', tokenErr);
              setOrePrice(null);
            } finally {
              setPricesLoading(false);
            }
      } catch (err) {
        console.error('Error fetching SOL price:', err);
        // Continue without prices - USD calculations will show 0
        setPricesLoading(false);
      }
    };

    fetchPrices();
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-load profile when wallet is connected
  useEffect(() => {
    if (!connected || !publicKey) {
      // Clear data when wallet disconnects
          setMinerStats(null);
          setLeaderboardData(null);
          setOreLeaderboard([]);
          setHistoryData([]);
          setWalletBalance(null);
          setProfileData(null);
          setWalletBalances(null);
          setError(null);
          setProfileDataLoading(false);
          setMinerStatsLoading(false);
          setLeaderboardDataLoading(false);
          setOreLeaderboardLoading(false);
          return;
    }

    const address = publicKey.toBase58();
    void performWalletSearch(address);
  }, [connected, publicKey, performWalletSearch]);

  const formatTimeLabel = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return '';
    const now = Date.now();
    const diff = now - timestamp * 1000;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`;
    }
    return `${minutes}m ago`;
  };



  // Prepare graph data
  const graphData = historyData.map(point => ({
    time: formatTimeLabel(point.timestamp),
    timestamp: point.timestamp,
    unclaimedOre: (point.unclaimed_ore || 0) / ORE_CONVERSION_FACTOR,
    refinedOre: (point.refined_ore || 0) / ORE_CONVERSION_FACTOR,
    lifetimeSol: (point.lifetime_sol || 0) / LAMPORTS_PER_SOL,
    lifetimeOre: (point.lifetime_ore || 0) / ORE_CONVERSION_FACTOR,
  })).reverse(); // Reverse to show oldest to newest

  // Calculate metrics for refinore dashboard
  // Use balances API if available, otherwise fall back to minerStats
  const unrefinedOre = walletBalances ? parseFloat(walletBalances.unrefined || '0') : (minerStats ? minerStats.rewards_ore / ORE_CONVERSION_FACTOR : 0);
  const refinedOre = walletBalances ? parseFloat(walletBalances.refined || '0') : (minerStats ? minerStats.refined_ore / ORE_CONVERSION_FACTOR : 0);
  const stakedOre = walletBalances ? parseFloat(walletBalances.staked || '0') : 0;
  const totalOreCalculated = unrefinedOre + refinedOre + stakedOre;
  const totalOre = walletBalances && walletBalances.total ? parseFloat(walletBalances.total || '0') : totalOreCalculated;
  
  console.log('Total ORE calculation:', {
    walletBalances,
    unrefinedOre,
    refinedOre,
    stakedOre,
    totalOreCalculated,
    totalOre
  });

  // Helper functions to check if data is loading for specific fields
  const isRoundsDataLoading = () => {
    // Total Rounds depends on profileData, leaderboardData, or minerStats
    return profileDataLoading || leaderboardDataLoading || minerStatsLoading;
  };

  const isSolDeployedLoading = () => {
    // SOL Deployed depends on profileData or minerStats
    return profileDataLoading || minerStatsLoading;
  };

  const isSolEarnedLoading = () => {
    // SOL Earned depends on profileData or minerStats
    return profileDataLoading || minerStatsLoading;
  };

  const isOreEarnedLoading = () => {
    // ORE Earned depends on profileData or minerStats
    return profileDataLoading || minerStatsLoading;
  };

  const isUsdValuesLoading = () => {
    // USD values depend on prices
    return pricesLoading || isSolDeployedLoading() || isSolEarnedLoading() || isOreEarnedLoading();
  };

  // Use profile data summary if available, otherwise calculate from rounds or fall back to leaderboard or minerStats
  // Prioritize: summary > rounds array > leaderboard > estimate from miner stats
  const totalRounds = (profileData?.summary?.totalRounds !== undefined && profileData.summary.totalRounds !== null)
    ? Number(profileData.summary.totalRounds)
    : (profileData?.rounds && Array.isArray(profileData.rounds) && profileData.rounds.length > 0
      ? profileData.rounds.length
      : (leaderboardData && leaderboardData.rounds_played !== undefined && leaderboardData.rounds_played !== null
        ? Number(leaderboardData.rounds_played)
        : (minerStats && minerStats.total_deployed
          ? Math.floor(minerStats.total_deployed / LAMPORTS_PER_SOL / 0.1) // Rough estimate from total deployed
          : 0)));
    
  const totalWins = (profileData?.summary?.totalWins !== undefined && profileData.summary.totalWins !== null)
    ? Number(profileData.summary.totalWins)
    : (profileData?.rounds && Array.isArray(profileData.rounds) && profileData.rounds.length > 0
      ? profileData.rounds.filter((r: any) => r.isWinner === true).length
      : (leaderboardData && leaderboardData.rounds_won !== undefined && leaderboardData.rounds_won !== null
        ? Number(leaderboardData.rounds_won)
        : 0));
  
  console.log('Total Wins calculation:', {
    fromSummary: profileData?.summary?.totalWins,
    fromRounds: profileData?.rounds?.filter((r: any) => r.isWinner === true).length,
    fromLeaderboard: leaderboardData?.rounds_won,
    final: totalWins
  });
  
  // Use summary values if available, otherwise calculate from rounds
  const solDeployedRaw = profileData?.summary?.totalSolDeployed !== undefined && profileData.summary.totalSolDeployed !== null
    ? String(profileData.summary.totalSolDeployed)
    : null;
  
  const solDeployedFromRounds = profileData?.rounds && Array.isArray(profileData.rounds) && profileData.rounds.length > 0
    ? profileData.rounds.reduce((sum: number, r: any) => {
        const deployed = parseFloat(String(r.deployedSol || '0')) || 0;
        return sum + deployed;
      }, 0)
    : 0;
  
  const solDeployedFromMinerStats = minerStats && minerStats.total_deployed
    ? minerStats.total_deployed / LAMPORTS_PER_SOL
    : 0;
  
  // Prefer summary, then rounds, then miner stats (even if miner stats is 0, it's valid)
  const solDeployed = solDeployedRaw !== null
    ? (parseFloat(solDeployedRaw) || 0)
    : (solDeployedFromRounds > 0
      ? solDeployedFromRounds
      : solDeployedFromMinerStats); // Use miner stats even if 0 (it's a valid value)
  
  console.log('SOL Deployed calculation:', {
    fromSummary: solDeployedRaw,
    fromRounds: solDeployedFromRounds,
    fromMinerStats: solDeployedFromMinerStats,
    final: solDeployed
  });
  
  const solEarned = (profileData?.summary?.totalSolEarned !== undefined && profileData.summary.totalSolEarned !== null)
    ? (parseFloat(String(profileData.summary.totalSolEarned)) || 0)
    : (profileData?.rounds && Array.isArray(profileData.rounds) && profileData.rounds.length > 0
      ? profileData.rounds.reduce((sum: number, r: any) => sum + (parseFloat(String(r.solEarned || '0')) || 0), 0)
      : (minerStats && minerStats.lifetime_rewards_sol
        ? minerStats.lifetime_rewards_sol / LAMPORTS_PER_SOL
        : 0));
  
  console.log('SOL Earned calculation:', {
    fromSummary: profileData?.summary?.totalSolEarned,
    fromMinerStats: minerStats ? minerStats.lifetime_rewards_sol / LAMPORTS_PER_SOL : null,
    final: solEarned
  });
  
  const oreEarned = profileData?.summary?.totalOreEarned
    ? parseFloat(profileData.summary.totalOreEarned)
    : (profileData?.rounds
      ? profileData.rounds.reduce((sum: number, r: any) => sum + parseFloat(r.oreEarned || '0'), 0)
      : (minerStats ? minerStats.lifetime_rewards_ore / ORE_CONVERSION_FACTOR : 0));
  
  // Calculate net SOL change from profile data if available, otherwise from minerStats
  const netSolChange = profileData?.summary?.netSol
    ? parseFloat(profileData.summary.netSol)
    : (solEarned - solDeployed);
  
  const costPerOreSol = oreEarned > 0 && solDeployed > 0
    ? solDeployed / oreEarned
    : 0;
  const costPerOreUsd = (costPerOreSol * (solPrice || 0)) / 10;

  const avgSolPerRound = profileData?.summary?.avgSolPerRound
    ? parseFloat(profileData.summary.avgSolPerRound)
    : (totalRounds > 0 ? solDeployed / totalRounds : 0);

  // Calculate win rate
  const winRate = totalRounds > 0 
    ? ((totalWins / totalRounds) * 100).toFixed(1)
    : (leaderboardData 
    ? leaderboardData.rounds_played > 0 
      ? ((leaderboardData.rounds_won / leaderboardData.rounds_played) * 100).toFixed(1)
      : '0.0'
      : '0.0');

  // Calculate USD values - ensure values are numbers and prices are available
  const solEarnedUsd = (solPrice && typeof solPrice === 'number' && typeof solEarned === 'number' && !isNaN(solEarned)) 
    ? solEarned * solPrice 
    : 0;
  const solDeployedUsd = (solPrice && typeof solPrice === 'number' && typeof solDeployed === 'number' && !isNaN(solDeployed)) 
    ? solDeployed * solPrice 
    : 0;
  
  // Debug logging
  console.log('Price calculations:', {
    solPrice,
    orePrice,
    solEarned,
    solDeployed,
    totalOre,
    solEarnedUsd,
    solDeployedUsd
  });
  
  const oreValueUsd = (orePrice && typeof orePrice === 'number' && !isNaN(orePrice) && typeof totalOre === 'number' && !isNaN(totalOre)) 
    ? totalOre * orePrice 
    : 0;
  const truePnl = solEarnedUsd + oreValueUsd - solDeployedUsd;
  
  console.log('ORE Value USD:', oreValueUsd, 'from totalOre:', totalOre, 'orePrice:', orePrice);

  // Show connect wallet message if not connected
  if (!connected || !publicKey) {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-slate-100 mb-2">My Profile</h1>
            <p className="text-slate-400 text-lg">View your mining statistics and performance</p>
          </div>

          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-12 text-center">
            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-2xl font-semibold text-slate-200 mb-2">Connect Your Wallet</h2>
            <p className="text-slate-400 mb-6">Connect your wallet to view your mining profile and statistics.</p>
            <button
              onClick={() => setVisible(true)}
              disabled={connecting}
              className="bg-white text-black hover:bg-gray-100 rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">My Profile</h1>
          <p className="text-slate-400 text-lg">View your mining statistics and performance</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Loading Indicator - Only show when no data yet */}
        {loading && !profileData && !minerStats && !walletBalances && (
          <div className="mb-6 bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400"></div>
            <p className="text-amber-400 font-semibold">Loading profile data...</p>
          </div>
        )}

        {/* Main Stats Panel - Always show when wallet is connected or when we have any data */}
        {(minerStats || profileData || walletBalances || loading) && (
          <div className="space-y-6">
            {/* Current Balances Section */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Current Balances
                </h2>
                {minerStats && (
                <a
                  href={`https://solscan.io/account/${minerStats.authority}`}
                  target="_blank"
                  rel="noopener noreferrer"
                    className="text-sm text-blue-400 hover:text-blue-300 underline whitespace-nowrap flex items-center gap-1"
                >
                    View on Solscan
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </a>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Unrefined ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Unrefined ORE</p>
                  {loading && !walletBalances ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
            </div>
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(unrefinedOre * ORE_CONVERSION_FACTOR)}
                    </p>
                  )}
                </div>

                {/* Refined ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Refined ORE</p>
                  {loading && !walletBalances ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
                  </div>
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(refinedOre * ORE_CONVERSION_FACTOR)}
                    </p>
                  )}
            </div>

                {/* Staked ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Staked ORE</p>
                  {loading && !walletBalances ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
              </div>
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(stakedOre * ORE_CONVERSION_FACTOR)}
                    </p>
                  )}
                </div>

                {/* Total ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Total ORE</p>
                  {loading && !walletBalances ? (
                  <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
                  </div>
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(totalOre * ORE_CONVERSION_FACTOR)}
                    </p>
                  )}
                </div>

                {/* Leaderboard Rank */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Leaderboard Rank
                  </p>
                  {isLeaderboardRankLoading() ? (
                    <LoadingIndicator />
                  ) : oreLeaderboard.length > 0 && minerStats ? (
                    <p className="text-2xl font-bold text-white">
                      #{(() => {
                        const index = oreLeaderboard.findIndex(entry => entry.authority === minerStats.authority);
                        return index >= 0 ? index + 1 : 'N/A';
                      })()}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-slate-500">—</p>
                  )}
                </div>
              </div>
            </div>

            {/* Mining Performance Section */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Mining Performance
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Rounds */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Total Rounds
                  </p>
                  {isRoundsDataLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white">{totalRounds.toLocaleString()}</p>
                  )}
            </div>

                {/* Total Wins */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Total Wins
                  </p>
                  {isRoundsDataLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white">{totalWins.toLocaleString()}</p>
                  )}
              </div>

                {/* Win Rate */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Win Rate
                  </p>
                  {isRoundsDataLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white">{winRate}%</p>
                  )}
              </div>

                {/* ORE Earned */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                    ORE Earned
                  </p>
                  {isOreEarnedLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(oreEarned * ORE_CONVERSION_FACTOR)}
                    </p>
                  )}
              </div>

                {/* Cost per ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Cost per ORE
                  </p>
                  {(isSolDeployedLoading() || isOreEarnedLoading() || pricesLoading) ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white">${costPerOreUsd > 0 ? formatCurrency(costPerOreUsd) : '0.00'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Financial Analysis Section */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Financial Analysis
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* SOL Deployed */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <SolanaLogo width={16} height={16} />
                    SOL Deployed
                  </p>
                  {isSolDeployedLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <SolanaLogo width={24} />
                      {solDeployed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                    </p>
                  )}
                </div>

                {/* SOL Earned */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <SolanaLogo width={16} height={16} />
                    SOL Earned
                  </p>
                  {isSolEarnedLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <SolanaLogo width={24} />
                      {solEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                  )}
                </div>

                {/* Net SOL (PNL) */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <SolanaLogo width={16} height={16} />
                    Net SOL (PNL)
                  </p>
                  {(isSolDeployedLoading() || isSolEarnedLoading()) ? (
                    <LoadingIndicator />
                  ) : (
                    <p className={`text-2xl font-bold flex items-center gap-2 ${netSolChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      <SolanaLogo width={24} />
                      {netSolChange >= 0 ? '+' : ''}{netSolChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                  )}
                </div>

                {/* Average SOL/Round */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <SolanaLogo width={16} height={16} />
                    Average SOL/Round
                  </p>
                  {(isSolDeployedLoading() || isRoundsDataLoading()) ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <SolanaLogo width={24} />
                      {avgSolPerRound.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </p>
                  )}
                </div>

                {/* SOL Earned USD */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">SOL Earned</p>
                  {isUsdValuesLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white">${formatCurrency(solEarnedUsd)}</p>
                  )}
                </div>

                {/* SOL Deployed USD */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">SOL Deployed</p>
                  {isUsdValuesLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white">${formatCurrency(solDeployedUsd)}</p>
                  )}
                </div>

                {/* ORE Value USD */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                    ORE Value
                  </p>
                  {isUsdValuesLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      ${formatCurrency(oreValueUsd)}
                    </p>
                  )}
                </div>

                {/* True PNL */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2">True PNL</p>
                  {isUsdValuesLoading() ? (
                    <LoadingIndicator />
                  ) : (
                    <p className={`text-2xl font-bold ${truePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {truePnl >= 0 ? '+' : ''}${formatCurrency(truePnl)}
                    </p>
                  )}
                </div>
              </div>
              {solPrice && orePrice && (
                <p className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-700 flex items-center gap-1 justify-center">
                  Using current prices: <SolanaLogo width={12} /> SOL ${formatCurrency(solPrice)} • <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> ORE ${formatCurrency(orePrice)}
                </p>
              )}
            </div>

            {/* Graph Section */}
            {historyData.length > 0 && minerStats && (
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-200">
                    Miner Stats: {minerStats.authority.slice(0, 12)}...{minerStats.authority.slice(-8)}
                  </h3>
                  <button
                    onClick={() => setShowGraph(!showGraph)}
                    className="text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showGraph ? 'Hide Graph' : 'Show Graph'}
                  </button>
                </div>
                {showGraph && (
                  <div className="h-96 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={graphData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="time" 
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#9CA3AF"
                          style={{ fontSize: '12px' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F3F4F6'
                          }}
                        />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="unclaimedOre" 
                          stroke="#3B82F6" 
                          strokeWidth={2}
                          name="Unclaimed ORE"
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="refinedOre" 
                          stroke="#A855F7" 
                          strokeWidth={2}
                          name="Refined ORE"
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="lifetimeSol" 
                          stroke="#F97316" 
                          strokeWidth={2}
                          name="Lifetime SOL"
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="lifetimeOre" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          name="Lifetime ORE"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading or Empty State */}
        {!minerStats && !loading && !error && (
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading profile data...</p>
          </div>
        )}
      </div>
    </div>
  );
}
