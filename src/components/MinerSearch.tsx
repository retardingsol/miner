import { useState } from 'react';
import { getMinerStats, getLeaderboard } from '../services/api';
import { SolanaLogo } from './SolanaLogo';

const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11; // ORE values in miner stats use 1e11 conversion

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

interface LeaderboardData {
  pubkey: string;
  rounds_played: number;
  rounds_won: number;
  total_sol_deployed: number;
  total_sol_earned: number;
  total_ore_earned: number;
  net_sol_change: number;
}

export function MinerSearch() {
  const [walletAddress, setWalletAddress] = useState('');
  const [minerStats, setMinerStats] = useState<MinerStats | null>(null);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      // Fetch both miner stats and leaderboard data for complete information
      const [stats, leaderboard] = await Promise.all([
        getMinerStats(walletAddress.trim()),
        getLeaderboard().catch(() => []), // Don't fail if leaderboard fails
      ]);
      
      setMinerStats(stats);
      
      // Find this wallet in leaderboard data for lifetime stats
      const walletData = Array.isArray(leaderboard) 
        ? leaderboard.find((entry: LeaderboardData) => entry.pubkey === walletAddress.trim())
        : null;
      
      if (walletData) {
        setLeaderboardData(walletData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch miner stats';
      setError(errorMessage);
      console.error('Error fetching miner stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatSol = (value: number) => {
    const sol = value / LAMPORTS_PER_SOL;
    return sol.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatOre = (value: number) => {
    const ore = value / ORE_CONVERSION_FACTOR;
    return ore.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp || timestamp === 0) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="bg-[#21252C] rounded-lg border border-slate-700 overflow-hidden">
      {/* Search Form - Always visible, compact */}
      <div className="p-4">
        <form onSubmit={handleSearch}>
          <div className="flex gap-2">
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              placeholder="Search miner by wallet address..."
              className="flex-1 px-4 py-2 bg-slate-800 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 sm:px-6 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed text-sm whitespace-nowrap"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 pb-4">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold text-sm">Error</p>
            <p className="text-red-300 text-xs mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Miner Stats - Collapsible/Expandable */}
      {minerStats && (
        <div className="border-t border-slate-700 space-y-4 max-h-[600px] overflow-y-auto">
          <div className="p-4 space-y-4">
          {/* Wallet Header */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono text-slate-200 break-all">
                {minerStats.authority}
              </p>
              <a
                href={`https://solscan.io/account/${minerStats.authority}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline ml-4 flex-shrink-0"
              >
                View on Solscan →
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tracked Performance Section */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <h3 className="text-lg font-semibold text-slate-100">Tracked Performance</h3>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Played</p>
                    <p className="text-lg font-bold text-slate-100">
                      {leaderboardData ? leaderboardData.rounds_played.toLocaleString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Won</p>
                    <p className="text-lg font-bold text-slate-100">
                      {leaderboardData ? leaderboardData.rounds_won.toLocaleString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Win Rate</p>
                    <p className="text-lg font-bold text-slate-100">
                      {leaderboardData && leaderboardData.rounds_played > 0
                        ? `${((leaderboardData.rounds_won / leaderboardData.rounds_played) * 100).toFixed(1)}%`
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Tracked ORE Earned</p>
                    <div className="flex items-center gap-2">
                      <img 
                        src="/orelogo.jpg" 
                        alt="ORE" 
                        className="w-4 h-4 rounded"
                      />
                      <p className="text-lg font-bold text-blue-400">
                        {leaderboardData 
                          ? formatOre(leaderboardData.total_ore_earned)
                          : formatOre(minerStats.lifetime_rewards_ore)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* SOL Section */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <div className="flex items-center gap-2 mb-4">
                <SolanaLogo width={20} height={20} />
                <h3 className="text-lg font-semibold text-slate-100">SOL</h3>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Deployed</p>
                  <div className="flex items-center gap-2">
                    <SolanaLogo width={18} height={18} />
                    <p className="text-lg font-bold text-slate-100">
                      {leaderboardData 
                        ? formatSol(leaderboardData.total_sol_deployed)
                        : formatSol(minerStats.total_deployed)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Earned</p>
                  <div className="flex items-center gap-2">
                    <SolanaLogo width={18} height={18} />
                    <p className="text-lg font-bold text-green-400">
                      {leaderboardData 
                        ? formatSol(leaderboardData.total_sol_earned)
                        : formatSol(minerStats.lifetime_rewards_sol)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Net</p>
                  <div className="flex items-center gap-2">
                    <SolanaLogo width={18} height={18} />
                    <p className={`text-lg font-bold ${
                      (leaderboardData 
                        ? leaderboardData.total_sol_earned - leaderboardData.total_sol_deployed
                        : minerStats.lifetime_rewards_sol - minerStats.total_deployed) >= 0 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {formatSol(
                        leaderboardData 
                          ? leaderboardData.total_sol_earned - leaderboardData.total_sol_deployed
                          : minerStats.lifetime_rewards_sol - minerStats.total_deployed
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ORE Balance Section */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h3 className="text-lg font-semibold text-slate-100">ORE Balance</h3>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Unclaimed</p>
                  <div className="flex items-center gap-2">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-4 h-4 rounded"
                    />
                    <p className="text-lg font-bold text-blue-400">
                      {formatOre(minerStats.rewards_ore)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Fee (10%)</p>
                  <div className="flex items-center gap-2">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-4 h-4 rounded"
                    />
                    <p className="text-lg font-bold text-red-400">
                      -{formatOre(minerStats.rewards_ore * 0.1)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Refined</p>
                  <div className="flex items-center gap-2">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-4 h-4 rounded"
                    />
                    <p className="text-lg font-bold text-slate-100">
                      {formatOre(minerStats.refined_ore)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Net ORE</p>
                  <div className="flex items-center gap-2">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-4 h-4 rounded"
                    />
                    <p className="text-lg font-bold text-blue-400">
                      {formatOre(minerStats.rewards_ore * 0.9 + minerStats.refined_ore)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest Round Section */}
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 lg:col-span-2">
              <h3 className="text-lg font-semibold text-slate-100 mb-4">Latest Round</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Latest Round</p>
                  <p className="text-lg font-bold text-slate-100">
                    #{minerStats.round_id.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">Deployed</p>
                  <div className="flex items-center gap-2">
                    <SolanaLogo width={18} height={18} />
                    <p className="text-lg font-bold text-slate-100">
                      {minerStats.deployed && minerStats.deployed.length > 0 
                        ? formatSol(minerStats.deployed[minerStats.deployed.length - 1])
                        : '0.00'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-1">SOL Rewards</p>
                  <div className="flex items-center gap-2">
                    <SolanaLogo width={18} height={18} />
                    <p className="text-lg font-bold text-slate-100">
                      {formatSol(minerStats.rewards_sol)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Last Claim Times */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Last Claim SOL</p>
                <p className="text-sm text-slate-200">
                  {formatDate(minerStats.last_claim_sol_at)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Last Claim ORE</p>
                <p className="text-sm text-slate-200">
                  {formatDate(minerStats.last_claim_ore_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Deployment Grid (if available) */}
          {minerStats.deployed && minerStats.deployed.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <p className="text-xs text-slate-400 mb-2">Recent Deployments (Last {minerStats.deployed.length} rounds)</p>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 max-h-32 overflow-y-auto">
                {minerStats.deployed.map((deployed, index) => (
                  <div
                    key={index}
                    className="bg-slate-700/50 rounded p-2 text-center border border-slate-600"
                  >
                    <p className="text-xs text-slate-400 mb-1">#{index + 1}</p>
                    <p className="text-xs font-semibold text-slate-200">
                      {formatSol(deployed)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

