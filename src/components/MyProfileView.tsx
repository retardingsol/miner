import { useState } from 'react';
import { getMinerStats, getWalletBalance, getLeaderboard, getMinerHistory } from '../services/api';
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
  const [walletAddress, setWalletAddress] = useState('');
  const [minerStats, setMinerStats] = useState<MinerStats | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry | null>(null);
  const [historyData, setHistoryData] = useState<HistoryDataPoint[]>([]);
  const [, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show24hrOre, setShow24hrOre] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  const formatSol = (lamports: number) => {
    const sol = lamports / LAMPORTS_PER_SOL;
    return sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

  const formatOre = (ore: number) => {
    const converted = ore / ORE_CONVERSION_FACTOR;
    return converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  };

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

  const formatDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    setLoading(true);
    setError(null);
    setMinerStats(null);
    setLeaderboardData(null);
    setHistoryData([]);
    setWalletBalance(null);
    setShowGraph(false);

    try {
      const address = walletAddress.trim();
      const [stats, balance, history] = await Promise.all([
        getMinerStats(address),
        getWalletBalance(address).catch(() => null),
        getMinerHistory(address).catch(() => []),
      ]);
      
      setMinerStats(stats);
      setWalletBalance(balance);
      setHistoryData(history);

      // Fetch leaderboard data to get rounds_played and rounds_won
      try {
        const leaderboard = await getLeaderboard();
        const minerEntry = leaderboard.find(entry => entry.pubkey === address);
        if (minerEntry) {
          setLeaderboardData(minerEntry);
        }
      } catch (err) {
        console.error('Failed to fetch leaderboard data:', err);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch miner stats';
      setError(errorMessage);
      setMinerStats(null);
      setLeaderboardData(null);
      setHistoryData([]);
      setWalletBalance(null);
    } finally {
      setLoading(false);
    }
  };

  // Calculate 24hr ORE earned (difference between current and 24h ago)
  const calculate24hrOreEarned = () => {
    if (historyData.length < 2) return 0;
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
    
    // Find closest data point to 24h ago
    let closest24hAgo = historyData[0];
    for (const point of historyData) {
      const pointTime = point.timestamp * 1000;
      if (pointTime <= twentyFourHoursAgo) {
        closest24hAgo = point;
      } else {
        break;
      }
    }
    
    const currentOre = (minerStats?.rewards_ore || 0) / ORE_CONVERSION_FACTOR;
    const ore24hAgo = (closest24hAgo.unclaimed_ore || 0) / ORE_CONVERSION_FACTOR;
    return currentOre - ore24hAgo;
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

  // Calculate win rate
  const winRate = leaderboardData 
    ? leaderboardData.rounds_played > 0 
      ? ((leaderboardData.rounds_won / leaderboardData.rounds_played) * 100).toFixed(1)
      : '0.0'
    : '0.0';

  // Calculate net ORE
  const netOre = minerStats 
    ? ((minerStats.rewards_ore + minerStats.refined_ore) / ORE_CONVERSION_FACTOR)
    : 0;
  
  const oreFee = minerStats ? (minerStats.rewards_ore * 0.1) / ORE_CONVERSION_FACTOR : 0;
  const netOreAfterFee = netOre - oreFee;

  // Calculate net SOL change
  const netSolChange = minerStats 
    ? (minerStats.lifetime_rewards_sol - minerStats.total_deployed) / LAMPORTS_PER_SOL
    : 0;

  // Get latest round deployment (first deployment in array or 0)
  const latestRoundDeployed = minerStats?.deployed && minerStats.deployed.length > 0
    ? minerStats.deployed[minerStats.deployed.length - 1] / LAMPORTS_PER_SOL
    : 0;

  const latestRoundSolRewards = minerStats?.rewards_sol 
    ? minerStats.rewards_sol / LAMPORTS_PER_SOL
    : 0;

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
                disabled={loading}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed whitespace-nowrap"
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
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

        {/* Main Stats Panel */}
        {minerStats && (
          <div className="space-y-6">
            {/* Wallet Header */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-400 mb-2">Wallet Address</p>
                  <p className="text-lg font-mono text-slate-200 break-all">{minerStats.authority}</p>
                </div>
                <a
                  href={`https://solscan.io/account/${minerStats.authority}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:text-blue-300 underline whitespace-nowrap"
                >
                  View on Solscan →
                </a>
              </div>
            </div>

            {/* Tracked Performance Section */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <h3 className="text-lg font-semibold text-slate-200">Tracked Performance</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Played</span>
                    <span className="text-lg font-semibold text-slate-200">
                      {leaderboardData?.rounds_played.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Won</span>
                    <span className="text-lg font-semibold text-slate-200">
                      {leaderboardData?.rounds_won.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Win Rate</span>
                    <span className="text-lg font-semibold text-slate-200">{winRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Tracked ORE Earned</span>
                    <span className="text-lg font-semibold text-blue-400">
                      {formatOre(minerStats.lifetime_rewards_ore)}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <SolanaLogo width={20} />
                    <span className="text-sm font-semibold text-slate-300">SOL</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Deployed</span>
                    <span className="text-lg font-semibold text-slate-200">
                      {formatSol(minerStats.total_deployed)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Earned</span>
                    <span className="text-lg font-semibold text-slate-200">
                      {formatSol(minerStats.lifetime_rewards_sol)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">Net</span>
                    <span className={`text-lg font-semibold ${netSolChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {netSolChange >= 0 ? '+' : ''}{netSolChange.toFixed(4)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ORE Balance Section */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <img 
                  src="/orelogo.jpg" 
                  alt="ORE" 
                  className="w-5 h-5 rounded"
                />
                <h3 className="text-lg font-semibold text-slate-200">ORE Balance</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Unclaimed</span>
                  <span className="text-lg font-semibold text-blue-400">
                    {formatOre(minerStats.rewards_ore)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Fee (10%)</span>
                  <span className="text-lg font-semibold text-red-400">
                    -{formatOre(oreFee * ORE_CONVERSION_FACTOR)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Refined</span>
                  <span className="text-lg font-semibold text-slate-200">
                    {formatOre(minerStats.refined_ore)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Net ORE</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-blue-400">
                      {formatOre(netOreAfterFee * ORE_CONVERSION_FACTOR)}
                    </span>
                    <span className="text-sm text-red-400">-3.5%</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-700">
                  <button
                    onClick={() => setShow24hrOre(!show24hrOre)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <svg 
                      className={`w-4 h-4 transition-transform ${show24hrOre ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Show 24hr ORE Earned
                  </button>
                  {show24hrOre && (
                    <div className="mt-2 text-sm text-slate-300">
                      {calculate24hrOreEarned().toFixed(4)} ORE
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Latest Round Section */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Latest Round</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Round ID</span>
                  <span className="text-lg font-semibold text-slate-200">#{minerStats.round_id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Deployed</span>
                  <span className="text-lg font-semibold text-slate-200">
                    {latestRoundDeployed.toFixed(5)} SOL
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">SOL Rewards</span>
                  <span className="text-lg font-semibold text-yellow-400">
                    {latestRoundSolRewards.toFixed(4)} SOL
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Grid - Original Card Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Lifetime SOL Rewards */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <SolanaLogo width={20} />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Lifetime SOL Rewards</p>
                </div>
                <p className="text-2xl font-bold text-slate-200">{formatSol(minerStats.lifetime_rewards_sol)}</p>
                <p className="text-xs text-slate-500 mt-1">Total SOL earned from mining</p>
              </div>

              {/* Lifetime ORE Rewards */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src="/orelogo.jpg" 
                    alt="ORE" 
                    className="w-5 h-5 rounded"
                  />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Lifetime ORE Rewards</p>
                </div>
                <p className="text-2xl font-bold text-slate-200">{formatOre(minerStats.lifetime_rewards_ore)}</p>
                <p className="text-xs text-slate-500 mt-1">Total ORE earned from mining</p>
              </div>

              {/* Total SOL Deployed */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <SolanaLogo width={20} />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Total SOL Deployed</p>
                </div>
                <p className="text-2xl font-bold text-slate-200">{formatSol(minerStats.total_deployed)}</p>
                <p className="text-xs text-slate-500 mt-1">Total SOL spent on mining</p>
              </div>

              {/* Net SOL Change */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <SolanaLogo width={20} />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Net SOL Change</p>
                </div>
                {(() => {
                  const netChange = (minerStats.lifetime_rewards_sol - minerStats.total_deployed) / LAMPORTS_PER_SOL;
                  return (
                    <>
                      <p className={`text-2xl font-bold ${netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {netChange >= 0 ? '+' : ''}{netChange.toFixed(4)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Earned - Deployed</p>
                    </>
                  );
                })()}
              </div>

              {/* Unrefined ORE */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src="/orelogo.jpg" 
                    alt="ORE" 
                    className="w-5 h-5 rounded"
                  />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Unrefined ORE</p>
                </div>
                <p className="text-2xl font-bold text-green-400">{formatOre(minerStats.rewards_ore)}</p>
                <p className="text-xs text-slate-500 mt-1">ORE waiting to be refined</p>
              </div>

              {/* Refined ORE */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src="/orelogo.jpg" 
                    alt="ORE" 
                    className="w-5 h-5 rounded"
                  />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Refined ORE</p>
                </div>
                <p className="text-2xl font-bold text-slate-200">{formatOre(minerStats.refined_ore)}</p>
                <p className="text-xs text-slate-500 mt-1">ORE that has been refined</p>
              </div>

              {/* Current Round ID */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <p className="text-sm text-slate-400 uppercase tracking-wider mb-3">Current Round ID</p>
                <p className="text-2xl font-bold text-slate-200">#{minerStats.round_id}</p>
                <p className="text-xs text-slate-500 mt-1">Latest mining round</p>
              </div>

              {/* Checkpoint ID */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <p className="text-sm text-slate-400 uppercase tracking-wider mb-3">Checkpoint ID</p>
                <p className="text-2xl font-bold text-slate-200">#{minerStats.checkpoint_id}</p>
                <p className="text-xs text-slate-500 mt-1">Latest checkpoint</p>
              </div>

              {/* Checkpoint Fee */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <SolanaLogo width={20} />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Checkpoint Fee</p>
                </div>
                <p className="text-2xl font-bold text-slate-200">{formatSol(minerStats.checkpoint_fee)}</p>
                <p className="text-xs text-slate-500 mt-1">Fee for latest checkpoint</p>
              </div>

              {/* Current SOL Rewards */}
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <SolanaLogo width={20} />
                  <p className="text-sm text-slate-400 uppercase tracking-wider">Current SOL Rewards</p>
                </div>
                <p className="text-2xl font-bold text-slate-200">{formatSol(minerStats.rewards_sol)}</p>
                <p className="text-xs text-slate-500 mt-1">Unclaimed SOL rewards</p>
              </div>
            </div>

            {/* Deployment History */}
            {minerStats.deployed && minerStats.deployed.length > 0 && (
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Deployment History</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {minerStats.deployed.map((deployment, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <SolanaLogo width={16} />
                        <span className="text-sm text-slate-300">Deployment #{index + 1}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{formatSol(deployment)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Total Deployments</span>
                    <span className="text-sm font-semibold text-slate-200">{minerStats.deployed.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Cumulative Deployment History */}
            {minerStats.cumulative && minerStats.cumulative.length > 0 && (
              <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-200 mb-4">Cumulative Deployment History</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {minerStats.cumulative.map((cumulative, index) => (
                    <div key={index} className="flex items-center justify-between py-2 px-4 bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <SolanaLogo width={16} />
                        <span className="text-sm text-slate-300">Cumulative #{index + 1}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{formatSol(cumulative)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Total Cumulative Entries</span>
                    <span className="text-sm font-semibold text-slate-200">{minerStats.cumulative.length}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Info */}
            <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">Additional Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">Last ORE Claim</p>
                  <p className="text-slate-200">{formatDate(minerStats.last_claim_ore_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Last SOL Claim</p>
                  <p className="text-slate-200">{formatDate(minerStats.last_claim_sol_at)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Wallet Address</p>
                  <p className="text-slate-200 font-mono text-sm break-all">{minerStats.authority}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Current Round ID</p>
                  <p className="text-slate-200">#{minerStats.round_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Checkpoint ID</p>
                  <p className="text-slate-200">#{minerStats.checkpoint_id}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">Total SOL Deployed</p>
                  <p className="text-slate-200">{formatSol(minerStats.total_deployed)}</p>
                </div>
              </div>
            </div>

            {/* Graph Section */}
            {historyData.length > 0 && (
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

            {/* View History Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowGraph(!showGraph)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-200 font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                View History
              </button>
            </div>
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
