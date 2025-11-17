import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { getMinerStats, getWalletBalance, getLeaderboard, getMinerHistory, getTokenCurrent, getProfileData, getWalletBalances, getOreLeaders } from '../services/api';
import { SolanaLogo } from './SolanaLogo';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11;

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
  const { publicKey, connected } = useWallet();
  const [walletAddress, setWalletAddress] = useState('');
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
  const [savedProfile, setSavedProfile] = useState<string | null>(null);
  const [autoLoadedFromWallet, setAutoLoadedFromWallet] = useState(false);

  const formatOre = (ore: number) => {
    const converted = ore / ORE_CONVERSION_FACTOR;
    return converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper function to perform wallet search (memoized to avoid dependency issues)
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

    try {
      const trimmedAddress = address.trim();
      const [stats, balance, history, profile, balances] = await Promise.allSettled([
        getMinerStats(trimmedAddress),
        getWalletBalance(trimmedAddress),
        getMinerHistory(trimmedAddress),
        getProfileData(trimmedAddress),
        getWalletBalances(trimmedAddress),
      ]);
      
      // Extract values from Promise.allSettled results
      const minerStatsResult = stats.status === 'fulfilled' ? stats.value : null;
      const walletBalanceResult = balance.status === 'fulfilled' ? balance.value : null;
      const historyResult = history.status === 'fulfilled' ? history.value : [];
      const profileResult = profile.status === 'fulfilled' ? profile.value : null;
      const balancesResult = balances.status === 'fulfilled' ? balances.value : null;

      // Log any failures for debugging
      if (stats.status === 'rejected') {
        console.error('Failed to fetch miner stats:', stats.reason);
      }
      if (balance.status === 'rejected') {
        console.error('Failed to fetch wallet balance:', balance.reason);
      }
      if (history.status === 'rejected') {
        console.error('Failed to fetch miner history:', history.reason);
      }
      if (profile.status === 'rejected') {
        console.error('Failed to fetch profile data:', profile.reason);
        console.error('Profile error details:', profile.reason?.message || profile.reason);
      }
      if (balances.status === 'rejected') {
        console.error('Failed to fetch wallet balances:', balances.reason);
      }
      
      setMinerStats(minerStatsResult);
      setWalletBalance(walletBalanceResult);
      setHistoryData(historyResult);
      setProfileData(profileResult);
      setWalletBalances(balancesResult);

      // Save wallet address to localStorage for future visits
      localStorage.setItem('ore-profile-wallet', trimmedAddress);

      // Fetch leaderboard data to get rounds_played and rounds_won (fallback)
      try {
        const leaderboard = await getLeaderboard();
        const minerEntry = leaderboard.find(entry => entry.pubkey === trimmedAddress);
        if (minerEntry) {
          setLeaderboardData(minerEntry);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard data:', err);
      }

      // Fetch ORE leaderboard to get rank by unrefined ORE
      try {
        const oreLeaders = await getOreLeaders();
        // Sort by rewards_ore (unrefined ORE) descending, same as leaderboard page
        const sortedOreLeaders = [...oreLeaders].sort((a, b) => b.rewards_ore - a.rewards_ore);
        setOreLeaderboard(sortedOreLeaders.map(leader => ({ authority: leader.authority, rewards_ore: leader.rewards_ore })));
      } catch (err) {
        console.error('Failed to fetch ORE leaderboard data:', err);
      }

      // Show error if critical data is missing
      if (!profileResult && !minerStatsResult) {
        setError('Unable to load profile data. Please check the wallet address and try again.');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch miner stats';
      console.error('Error in performWalletSearch:', err);
      setError(errorMessage);
      setMinerStats(null);
      setLeaderboardData(null);
      setOreLeaderboard([]);
      setHistoryData([]);
      setWalletBalance(null);
      setProfileData(null);
      setWalletBalances(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch SOL and ORE prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Fetch SOL price from CoinGecko
        const solResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solData = await solResponse.json();
        setSolPrice(solData.solana?.usd || null);

        // Fetch ORE price from token API
        const tokenData = await getTokenCurrent();
        setOrePrice(tokenData.priceUsd || null);
      } catch (err) {
        console.error('Error fetching prices:', err);
      }
    };

    fetchPrices();
    // Refresh prices every 60 seconds
    const interval = setInterval(fetchPrices, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load saved profile on mount and check URL parameters
  useEffect(() => {
    // Check for wallet parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const walletParam = urlParams.get('wallet');
    
    if (walletParam && walletParam.trim()) {
      setWalletAddress(walletParam.trim());
      performWalletSearch(walletParam.trim());
      return;
    }
    
    const savedWallet = localStorage.getItem('ore-profile-wallet');
    const savedAsProfile = localStorage.getItem('ore-saved-profile');
    if (savedAsProfile && savedAsProfile.trim()) {
      setSavedProfile(savedAsProfile);
      setWalletAddress(savedAsProfile);
      // Trigger search automatically after a short delay to ensure component is mounted
      const timer = setTimeout(() => {
        performWalletSearch(savedAsProfile);
      }, 100);
      return () => clearTimeout(timer);
    } else if (savedWallet && savedWallet.trim()) {
      setWalletAddress(savedWallet);
      const timer = setTimeout(() => {
        performWalletSearch(savedWallet);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [performWalletSearch]);

  // If a Phantom wallet is connected, auto-load that wallet into the profile view once
  useEffect(() => {
    if (!connected || !publicKey || autoLoadedFromWallet) return;

    const address = publicKey.toBase58();
    setWalletAddress(address);
    setAutoLoadedFromWallet(true);
    void performWalletSearch(address);
  }, [connected, publicKey, autoLoadedFromWallet, performWalletSearch]);

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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    await performWalletSearch(walletAddress);
  };

  const handleSaveProfile = () => {
    if (minerStats?.authority) {
      localStorage.setItem('ore-saved-profile', minerStats.authority);
      setSavedProfile(minerStats.authority);
    }
  };

  const handleLoadSavedProfile = () => {
    if (savedProfile) {
      setWalletAddress(savedProfile);
      performWalletSearch(savedProfile);
    }
  };

  const handleResetSavedProfile = () => {
    localStorage.removeItem('ore-saved-profile');
    setSavedProfile(null);
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
  const totalOre = walletBalances ? parseFloat(walletBalances.total || '0') : (unrefinedOre + refinedOre + stakedOre);

  // Use profile data summary if available, otherwise calculate from rounds or fall back to leaderboard
  const totalRounds = profileData?.summary?.totalRounds || profileData?.rounds?.length || leaderboardData?.rounds_played || 0;
  const totalWins = profileData?.summary?.totalWins || profileData?.rounds?.filter((r: any) => r.isWinner === true).length || leaderboardData?.rounds_won || 0;
  
  // Use summary values if available, otherwise calculate from rounds
  const solDeployed = profileData?.summary?.totalSolDeployed
    ? parseFloat(profileData.summary.totalSolDeployed)
    : (profileData?.rounds 
      ? profileData.rounds.reduce((sum: number, r: any) => sum + parseFloat(r.deployedSol || '0'), 0)
      : (minerStats ? minerStats.total_deployed / LAMPORTS_PER_SOL : 0));
  
  const solEarned = profileData?.summary?.totalSolEarned
    ? parseFloat(profileData.summary.totalSolEarned)
    : (profileData?.rounds
      ? profileData.rounds.reduce((sum: number, r: any) => sum + parseFloat(r.solEarned || '0'), 0)
      : (minerStats ? minerStats.lifetime_rewards_sol / LAMPORTS_PER_SOL : 0));
  
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

  // Calculate USD values
  const solEarnedUsd = solPrice && solEarned ? solEarned * solPrice : 0;
  const solDeployedUsd = solPrice && solDeployed ? solDeployed * solPrice : 0;
  const oreValueUsd = orePrice && totalOre ? totalOre * orePrice : 0;
  const truePnl = solEarnedUsd + oreValueUsd - solDeployedUsd;

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">My Profile</h1>
          <p className="text-slate-400 text-lg">View your mining statistics and performance</p>
        </div>

        {/* Search Bar */}
        <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-6">
          <form onSubmit={handleSearch}>
            <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                placeholder="Enter your Solana wallet address..."
                className="flex-1 px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
              <button
                type="submit"
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Searching...
                    </>
                  ) : (
                    'Search'
                  )}
                </button>
                {savedProfile && (
                  <>
                    <button
                      type="button"
                      onClick={handleLoadSavedProfile}
                      className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                    >
                      My Profile
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSavedProfile}
                      className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
                      title="Reset saved profile"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              {minerStats && minerStats.authority !== savedProfile && (
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="self-start px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save as My Profile
              </button>
              )}
            </div>
          </form>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="mb-6 bg-amber-500/20 border border-amber-500/50 rounded-lg p-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-400"></div>
            <p className="text-amber-400 font-semibold">Loading profile data...</p>
          </div>
        )}

        {/* Main Stats Panel - Always show when there's data or a search in progress */}
        {(minerStats || loading) && (
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  {loading && oreLeaderboard.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-16 rounded"></div>
                    </div>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Rounds */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Total Rounds
                  </p>
                  <p className="text-2xl font-bold text-white">{totalRounds.toLocaleString()}</p>
            </div>

                {/* Total Wins */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    Total Wins
                  </p>
                  <p className="text-2xl font-bold text-white">{totalWins.toLocaleString()}</p>
              </div>

                {/* Win Rate */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Win Rate
                  </p>
                  <p className="text-2xl font-bold text-white">{winRate}%</p>
              </div>

                {/* ORE Earned */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                    ORE Earned
                  </p>
                  <p className="text-2xl font-bold text-white flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                    {formatOre(oreEarned * ORE_CONVERSION_FACTOR)}
                  </p>
              </div>

                {/* Cost per ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Cost per ORE
                  </p>
                  <p className="text-2xl font-bold text-white">${costPerOreUsd > 0 ? formatCurrency(costPerOreUsd) : '0.00'}</p>
                </div>
              </div>
            </div>

            {/* Bottom Section: SOL Flow, USD Value, Avg SOL/Round */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* SOL Flow Analysis */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  SOL Flow Analysis
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">SOL Deployed</p>
                    <p className="text-xl font-bold text-white flex items-center gap-2">
                      <SolanaLogo width={20} />
                      {solDeployed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                    </p>
                      </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">SOL Earned</p>
                    <p className="text-xl font-bold text-white flex items-center gap-2">
                      <SolanaLogo width={20} />
                      {solEarned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                    </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">Net SOL (PNL)</p>
                    <p className={`text-xl font-bold flex items-center gap-2 ${netSolChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      <SolanaLogo width={20} />
                      {netSolChange >= 0 ? '+' : ''}{netSolChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* USD Value & True PNL */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  USD Value & True PNL
                </h2>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">SOL Earned</p>
                    <p className="text-xl font-bold text-white">${formatCurrency(solEarnedUsd)}</p>
                      </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">SOL Deployed</p>
                    <p className="text-xl font-bold text-white">${formatCurrency(solDeployedUsd)}</p>
                    </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">ORE Value</p>
                    <p className="text-xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" />
                      ${formatCurrency(oreValueUsd)}
                    </p>
                </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">True PNL</p>
                    <p className={`text-xl font-bold ${truePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {truePnl >= 0 ? '+' : ''}${formatCurrency(truePnl)}
                    </p>
                  </div>
                  {solPrice && orePrice && (
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-700 flex items-center gap-1">
                      Using current prices: <SolanaLogo width={12} /> SOL ${formatCurrency(solPrice)} • <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> ORE ${formatCurrency(orePrice)}
                    </p>
                  )}
                </div>
              </div>

              {/* Average SOL/Round */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Average SOL/Round
                </h2>
                <p className="text-2xl font-bold text-white flex items-center gap-2">
                  <SolanaLogo width={24} />
                  {avgSolPerRound.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                </p>
              </div>
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

        {/* Empty State */}
        {!minerStats && !loading && !error && (
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-12 text-center">
            <p className="text-slate-400">Enter a Solana wallet address above to view mining statistics</p>
          </div>
        )}
      </div>
    </div>
  );
}
