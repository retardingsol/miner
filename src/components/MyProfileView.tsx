import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useSearchParams } from 'react-router-dom';
import { getMinerStats, getWalletBalance, getLeaderboard, getMinerHistory, getTokenCurrent, getProfileData, getWalletBalances, getOreLeaders, getTopOreHolders } from '../services/api';
import { SolanaLogo } from './SolanaLogo';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PublicKey } from '@solana/web3.js';
import { getMinerOreRewards, type MinerOreRewards } from '../services/miningService';

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
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [searchParams] = useSearchParams();
  const [minerStats, setMinerStats] = useState<MinerStats | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry | null>(null);
  const [oreLeaderboard, setOreLeaderboard] = useState<Array<{ authority: string; rewards_ore: number }>>([]);
  const [topHolders, setTopHolders] = useState<Array<{ address: string; balance: number; owner: string }>>([]);
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
  const [, setOreLeaderboardLoading] = useState(false);
  const [, setTopHoldersLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [searchedWallet, setSearchedWallet] = useState<string | null>(null);
  const [minerOreRewards, setMinerOreRewards] = useState<MinerOreRewards | null>(null);

  const formatOre = (ore: number) => {
    const converted = ore / ORE_CONVERSION_FACTOR;
    return converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatSolAmount = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  };

  // Get wallet address from URL params or connected wallet
  const getWalletAddress = () => {
    const walletParam = searchParams.get('wallet');
    if (walletParam) {
      try {
        // Validate wallet address
        const pubkey = new PublicKey(walletParam);
        return pubkey.toBase58();
      } catch {
        return null;
      }
    }
    return connected && publicKey ? publicKey.toBase58() : null;
  };

  // Helper function to perform wallet search (progressive loading - fast display)
  const performWalletSearch = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    setMinerStats(null);
    setLeaderboardData(null);
    setOreLeaderboard([]);
    setTopHolders([]);
    setHistoryData([]);
    setWalletBalance(null);
    setProfileData(null);
    setWalletBalances(null);
    setShowGraph(false);
    setProfileDataLoading(false);
    setMinerStatsLoading(false);
    setLeaderboardDataLoading(false);
    setOreLeaderboardLoading(false);
    setTopHoldersLoading(false);
    setMinerOreRewards(null);

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

    // Fetch on-chain Miner ORE rewards via IDL (authoritative unrefined/refined)
    try {
      const pubkey = new PublicKey(trimmedAddress);
      getMinerOreRewards(connection, pubkey)
        .then((rewards) => {
          setMinerOreRewards(rewards);
        })
        .catch((err) => {
          console.error('Failed to fetch miner ORE rewards from chain:', err);
        });
    } catch (e) {
      console.error('Invalid wallet address for miner ORE rewards:', e);
    }

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

    // Fetch ORE leaderboard (for Top Miners rank - by unrefined ORE)
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

    // Fetch Top Holders (for Top Holders rank - by total ORE held)
    setTopHoldersLoading(true);
    getTopOreHolders(20)
      .then((holders) => {
        setTopHolders(holders);
        setTopHoldersLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch top holders data:', err);
        setTopHoldersLoading(false);
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

  // Auto-load profile when wallet is connected or URL param changes
  useEffect(() => {
    const walletAddr = getWalletAddress();
    if (walletAddr) {
      setSearchedWallet(walletAddr);
      
      // Clear previous data
      setProfileData(null);
      setMinerStats(null);
      setWalletBalances(null);
      setProfileDataLoading(false);
      setMinerStatsLoading(false);
      
      // Load profile for wallet
      void performWalletSearch(walletAddr);
    } else {
      setSearchedWallet(null);
      // Clear data when no wallet
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
    }
  }, [connected, publicKey, searchParams, performWalletSearch]);

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

  const formatRoundDateTime = (createdAt: string) => {
    if (!createdAt) return '';
    try {
      // Backend format: "2025-11-20 04:00:00.737025"
      const normalized = createdAt.replace(' ', 'T') + 'Z';
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) {
        return createdAt;
      }
      return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return createdAt;
    }
  };

  // Calculate metrics for refinore dashboard
  // 👉 Primary source of truth for balances is refinore v2 /balances API,
  //    but we prefer on-chain Miner account rewards when available.
  //    https://refinorev2-production.up.railway.app/api/profile/<wallet>/balances
  const onChainUnrefined =
    minerOreRewards ? minerOreRewards.rewardsOre.toNumber() / ORE_CONVERSION_FACTOR : null;
  const onChainRefined =
    minerOreRewards ? minerOreRewards.refinedOre.toNumber() / ORE_CONVERSION_FACTOR : null;

  const unrefinedOre =
    onChainUnrefined !== null && !Number.isNaN(onChainUnrefined)
      ? onChainUnrefined
      : walletBalances
      ? parseFloat(walletBalances.unrefined || '0')
      : 0;
  const refinedOre =
    onChainRefined !== null && !Number.isNaN(onChainRefined)
      ? onChainRefined
      : walletBalances
      ? parseFloat(walletBalances.refined || '0')
      : 0;
  const stakedOre = walletBalances ? parseFloat(walletBalances.staked || '0') : 0;
  const totalOreCalculated = unrefinedOre + refinedOre + stakedOre;
  const totalOre = walletBalances && walletBalances.total
    ? parseFloat(walletBalances.total || '0')
    : totalOreCalculated;
  // For the Mining Performance "ORE Earned" tile, we want to show the
  // current on-hand ORE (unrefined + refined), matching the balances panel.
  const currentOreEarnedFromBalances = unrefinedOre + refinedOre;
  
  // Ranks from balances API (preferred over legacy leaderboard endpoints)
  const topMinerRank =
    walletBalances && walletBalances.unrefinedRank !== undefined && walletBalances.unrefinedRank !== null
      ? Number(walletBalances.unrefinedRank)
      : null;
  const topHolderRank =
    walletBalances && walletBalances.rank !== undefined && walletBalances.rank !== null
      ? Number(walletBalances.rank)
      : null;
  
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

  // 👉 Core performance stats should come from refinore v2 profile API:
  //    https://refinorev2-production.up.railway.app/api/profile/<wallet>
  // Use summary if available, otherwise derive from the rounds array.
  const totalRoundsFromSummary: number | null =
    profileData?.summary?.totalRounds !== undefined &&
    profileData.summary.totalRounds !== null
    ? Number(profileData.summary.totalRounds)
      : null;

  const totalRoundsFromRounds: number | null =
    profileData?.rounds && Array.isArray(profileData.rounds)
      ? profileData.rounds.length
      : null;

  const totalRounds =
    totalRoundsFromSummary ?? totalRoundsFromRounds ?? 0;
    
  const totalWinsFromSummary: number | null =
    profileData?.summary?.totalWins !== undefined &&
    profileData.summary.totalWins !== null
    ? Number(profileData.summary.totalWins)
      : null;

  const totalWinsFromRounds: number | null =
    profileData?.rounds && Array.isArray(profileData.rounds)
      ? profileData.rounds.filter((r: any) => r.isWinner === true).length
      : null;

  const totalWins =
    totalWinsFromSummary ?? totalWinsFromRounds ?? 0;
  
  console.log('Total Wins calculation:', {
    fromSummary: profileData?.summary?.totalWins,
    fromRounds: profileData?.rounds?.filter((r: any) => r.isWinner === true).length,
    fromLeaderboard: leaderboardData?.rounds_won,
    final: totalWins
  });
  
  // Use summary values if available, otherwise calculate from rounds
  const solDeployedFromSummary: number | null =
    profileData?.summary?.totalSolDeployed !== undefined &&
    profileData.summary.totalSolDeployed !== null
      ? parseFloat(String(profileData.summary.totalSolDeployed)) || 0
    : null;
  
  const solDeployedFromRounds: number | null =
    profileData?.rounds && Array.isArray(profileData.rounds)
    ? profileData.rounds.reduce((sum: number, r: any) => {
        const deployed = parseFloat(String(r.deployedSol || '0')) || 0;
        return sum + deployed;
      }, 0)
      : null;
  
  const solDeployed =
    solDeployedFromSummary ?? solDeployedFromRounds ?? 0;
  
  console.log('SOL Deployed calculation (refinore profile):', {
    fromSummary: solDeployedFromSummary,
    fromRounds: solDeployedFromRounds,
    final: solDeployed,
  });
  
  const solEarnedFromSummary: number | null =
    profileData?.summary?.totalSolEarned !== undefined &&
    profileData.summary.totalSolEarned !== null
      ? parseFloat(String(profileData.summary.totalSolEarned)) || 0
      : null;

  const solEarnedFromRounds: number | null =
    profileData?.rounds && Array.isArray(profileData.rounds)
      ? profileData.rounds.reduce(
          (sum: number, r: any) =>
            sum + (parseFloat(String(r.solEarned || '0')) || 0),
          0,
        )
      : null;

  const solEarned = solEarnedFromSummary ?? solEarnedFromRounds ?? 0;
  
  console.log('SOL Earned calculation (refinore profile):', {
    fromSummary: solEarnedFromSummary,
    fromRounds: solEarnedFromRounds,
    final: solEarned,
  });
  
  const oreEarnedFromSummary: number | null =
    profileData?.summary?.totalOreEarned !== undefined &&
    profileData.summary?.totalOreEarned !== null
    ? parseFloat(profileData.summary.totalOreEarned)
      : null;

  const oreEarnedFromRounds: number | null =
    profileData?.rounds && Array.isArray(profileData.rounds)
      ? profileData.rounds.reduce(
          (sum: number, r: any) => sum + (parseFloat(r.oreEarned || '0') || 0),
          0,
        )
      : null;

  const oreEarned = oreEarnedFromSummary ?? oreEarnedFromRounds ?? 0;
  
  // Calculate net SOL change from profile data if available, otherwise derived from earned - deployed
  const netSolChange =
    profileData?.summary?.netSol !== undefined &&
    profileData.summary?.netSol !== null
    ? parseFloat(profileData.summary.netSol)
      : solEarned - solDeployed;
  
  const avgSolPerRound =
    profileData?.summary?.avgSolPerRound !== undefined &&
    profileData.summary?.avgSolPerRound !== null
    ? parseFloat(profileData.summary.avgSolPerRound)
      : totalRounds > 0
      ? solDeployed / totalRounds
      : 0;

  // Calculate win rate
  const winRate =
    totalRounds > 0
    ? ((totalWins / totalRounds) * 100).toFixed(1)
      : '0.0';

  // Calculate USD values - ensure values are numbers and prices are available
  const solEarnedUsd = (solPrice && typeof solPrice === 'number' && typeof solEarned === 'number' && !isNaN(solEarned)) 
    ? solEarned * solPrice 
    : 0;
  const solDeployedUsd = (solPrice && typeof solPrice === 'number' && typeof solDeployed === 'number' && !isNaN(solDeployed)) 
    ? solDeployed * solPrice 
    : 0;

  // Prefer totalSolCostUsd from Refinore summary for "true" cost basis.
  const totalSolCostUsdFromSummary =
    profileData?.summary?.totalSolCostUsd !== undefined &&
    profileData.summary?.totalSolCostUsd !== null
      ? Math.abs(
          parseFloat(String(profileData.summary.totalSolCostUsd)) || 0,
        )
      : null;

  // Cost per ORE in USD = (total SOL cost in USD) / total ORE earned.
  // Fallback to using current SOL deployed USD if cost is not available.
  const costPerOreUsd =
    oreEarned > 0
      ? (totalSolCostUsdFromSummary ?? solDeployedUsd) / oreEarned
      : 0;

  // Round history – latest rounds first, limit to 100 for UI
  const roundHistory = useMemo(() => {
    if (!profileData || !Array.isArray(profileData.rounds)) return [];
    const sorted = [...profileData.rounds].sort(
      (a: any, b: any) => Number(b.roundId ?? 0) - Number(a.roundId ?? 0),
    );
    return sorted.slice(0, 100);
  }, [profileData]);
  
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

  // Show connect wallet message if not connected and no wallet in URL
  const walletAddress = getWalletAddress();
  if (!walletAddress) {
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
          <h1 className="text-4xl font-bold text-slate-100 mb-2">
            {searchedWallet && searchedWallet !== publicKey?.toBase58() 
              ? `Profile: ${searchedWallet.slice(0, 4)}...${searchedWallet.slice(-4)}`
              : 'My Profile'}
          </h1>
          <p className="text-slate-400 text-lg">View mining statistics and performance</p>
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
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {/* Unrefined ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Unrefined ORE</p>
                  {loading && !walletBalances ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
            </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded flex-shrink-0" />
                      <p className="text-xl md:text-2xl font-bold text-white break-words overflow-wrap-anywhere truncate">
                        {formatOre(unrefinedOre * ORE_CONVERSION_FACTOR)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Refined ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Refined ORE</p>
                  {loading && !walletBalances ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
                  </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded flex-shrink-0" />
                      <p className="text-xl md:text-2xl font-bold text-white break-words overflow-wrap-anywhere truncate">
                        {formatOre(refinedOre * ORE_CONVERSION_FACTOR)}
                      </p>
                    </div>
                  )}
            </div>

                {/* Staked ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Staked ORE</p>
                  {loading && !walletBalances ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
              </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded flex-shrink-0" />
                      <p className="text-xl md:text-2xl font-bold text-white break-words overflow-wrap-anywhere truncate">
                        {formatOre(stakedOre * ORE_CONVERSION_FACTOR)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Total ORE */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-200 mb-2">Total ORE</p>
                  {loading && !walletBalances ? (
                  <div className="flex items-center gap-2">
                      <div className="animate-pulse bg-slate-700 h-8 w-24 rounded"></div>
                  </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded flex-shrink-0" />
                      <p className="text-xl md:text-2xl font-bold text-white break-words overflow-wrap-anywhere truncate">
                        {formatOre(totalOre * ORE_CONVERSION_FACTOR)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Top Miners Rank */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded flex-shrink-0" />
                    <span className="truncate">Top Miners</span>
                  </p>
                  <p className="text-xs text-slate-400 mb-2 truncate">Ranked by unrefined ORE</p>
                  {loading && !walletBalances ? (
                    <LoadingIndicator />
                  ) : topMinerRank !== null ? (
                    <p className="text-2xl font-bold text-white truncate">
                      #{topMinerRank.toLocaleString()}
                    </p>
                  ) : oreLeaderboard.length > 0 && (minerStats || walletAddress) ? (
                    <p className="text-2xl font-bold text-white truncate">
                      #{(() => {
                        const searchAddr =
                          walletAddress || (minerStats ? minerStats.authority : '');
                        const index = oreLeaderboard.findIndex(
                          (entry) => entry.authority === searchAddr,
                        );
                        return index >= 0 ? index + 1 : 'N/A';
                      })()}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-slate-500">—</p>
                  )}
                </div>

                {/* Top Holders Rank */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4 overflow-hidden">
                  <p className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded flex-shrink-0" />
                    <span className="truncate">Top Holders</span>
                  </p>
                  <p className="text-xs text-slate-400 mb-2 truncate">Ranked by total ORE held</p>
                  {loading && !walletBalances ? (
                    <LoadingIndicator />
                  ) : topHolderRank !== null ? (
                    <p className="text-2xl font-bold text-white truncate">
                      #{topHolderRank.toLocaleString()}
                    </p>
                  ) : topHolders.length > 0 && walletAddress ? (
                    <p className="text-2xl font-bold text-white truncate">
                      #{(() => {
                        const index = topHolders.findIndex(
                          (holder) => holder.owner === walletAddress,
                        );
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

                {/* ORE Earned (current holdings: unrefined + refined) */}
                <div className="bg-slate-800/50 border border-slate-600 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                    ORE Earned
                  </p>
                  {loading && !walletBalances ? (
                    <LoadingIndicator />
                  ) : (
                    <p className="text-2xl font-bold text-white flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(currentOreEarnedFromBalances * ORE_CONVERSION_FACTOR)}
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
                    Miner Stats: {minerStats.authority.slice(0, 12)}...
                    {minerStats.authority.slice(-8)}
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
                      <LineChart
                        data={graphData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
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
                            color: '#F3F4F6',
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

            {/* Round History Table */}
            {loading && !profileData ? (
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-200">
                    Round History
                  </h3>
                  <p className="text-xs text-slate-500">
                    Loading latest rounds...
                  </p>
          </div>
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="h-8 rounded bg-slate-800 animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ) : roundHistory.length > 0 ? (
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-slate-200">
                    Round History
                  </h3>
                  {profileData?.summary?.totalRounds && (
                    <p className="text-xs text-slate-500">
                      Showing{' '}
                      {Math.min(20, roundHistory.length).toLocaleString()} of{' '}
                      {Number(
                        profileData.summary.totalRounds,
                      ).toLocaleString()}{' '}
                      rounds
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs md:text-sm text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400">
                        <th className="py-2 pr-4">Round</th>
                        <th className="py-2 pr-4">Winning Tile</th>
                        <th className="py-2 pr-4">SOL Deployed</th>
                        <th className="py-2 pr-4">ORE Earned</th>
                        <th className="py-2 pr-4">SOL Earned</th>
                        <th className="py-2 pr-4">Net SOL (PNL)</th>
                        <th className="py-2 pr-4">Net USD (PNL)</th>
                        <th className="py-2 pr-4">Result</th>
                        <th className="py-2 pr-4">Date &amp; Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roundHistory.slice(0, 20).map((round: any) => {
                        const solDeployedVal =
                          parseFloat(String(round.deployedSol || '0')) || 0;
                        const oreEarnedVal =
                          parseFloat(String(round.oreEarned || '0')) || 0;
                        const solEarnedVal =
                          parseFloat(String(round.solEarned || '0')) || 0;
                        const netSolVal =
                          parseFloat(String(round.netSol || '0')) || 0;
                        const netUsdVal =
                          parseFloat(String(round.netUsd || '0')) || 0;

                        let resultLabel = 'LOSS';
                        if (round.hitMotherlode) {
                          resultLabel = 'MOTHERLODE';
                        } else if (round.isWinner && round.isSplit) {
                          resultLabel = 'SPLIT';
                        } else if (round.isWinner) {
                          resultLabel = 'SOLO';
                        }

                        const resultColor =
                          resultLabel === 'MOTHERLODE'
                            ? 'bg-purple-600/20 text-purple-300 border-purple-500/40'
                            : resultLabel === 'SPLIT'
                            ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                            : resultLabel === 'SOLO'
                            ? 'bg-amber-600/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-700/40 text-slate-300 border-slate-600/60';

                        return (
                          <tr
                            key={round.roundId}
                            className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-2 pr-4 text-slate-200 whitespace-nowrap">
                              #{round.roundId}
                            </td>
                            <td className="py-2 pr-4 whitespace-nowrap">
                              #{round.winningTile ?? '-'}
                            </td>
                            <td className="py-2 pr-4 whitespace-nowrap">
                              {formatSolAmount(solDeployedVal)} SOL
                            </td>
                            <td className="py-2 pr-4 whitespace-nowrap">
                              {oreEarnedVal.toFixed(5)} ORE
                            </td>
                            <td className="py-2 pr-4 whitespace-nowrap">
                              {formatSolAmount(solEarnedVal)} SOL
                            </td>
                            <td
                              className={`py-2 pr-4 whitespace-nowrap ${
                                netSolVal >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {netSolVal >= 0 ? '+' : ''}
                              {formatSolAmount(netSolVal)} SOL
                            </td>
                            <td
                              className={`py-2 pr-4 whitespace-nowrap ${
                                netUsdVal >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {netUsdVal >= 0 ? '+' : '-'}$
                              {formatCurrency(Math.abs(netUsdVal))}
                            </td>
                            <td className="py-2 pr-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${resultColor}`}
                              >
                                {resultLabel}
                              </span>
                            </td>
                            <td className="py-2 pr-4 whitespace-nowrap text-slate-400">
                              {formatRoundDateTime(round.createdAt)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : profileData && !loading ? (
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-2">
                  Round History
                </h3>
                <p className="text-sm text-slate-400">
                  No round history found for this wallet yet.
                </p>
              </div>
            ) : null}
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
