import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getLeaderboard, getOreLeaders, getTopOreHolders, getProfileData, getWalletBalances } from '../services/api';
import { getWalletLabel, getWalletDescription, getWalletFundingSources } from '../services/walletLabels';
import { SolanaLogo } from './SolanaLogo';

interface LeaderboardEntry {
  pubkey: string;
  rounds_played: number;
  rounds_won: number;
  total_sol_deployed: number;
  total_sol_earned: number;
  total_ore_earned: number;
  unclaimed_ore?: number;
  refined_ore?: number;
  staked_ore?: number;
  wallet_ore?: number;
  total_ore_held?: number;
  net_sol_change: number;
  sol_balance_direction: string;
  rank?: number;
}

const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11;

// Simple static mapping for known wallets → custom PFPs
const SPECIAL_WALLET_PFPS: Record<string, string> = {
  // Prefixes are first 6 chars of the wallet address
  '45db2F': '/orelogo.jpg',     // Treasury Wallet
  '3KgcHG': '/colesseum.jpg',   // Colosseum Squads Vault
  '8CRh2P': '/hhc.jpg',         // System/HHC Wallet
  '7fT33j': '/project0.jpg',    // Project0 Defi Vault
};

export function LeaderboardView() {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [displayMode, setDisplayMode] = useState<'ore' | 'ore-total' | 'sol' | 'stakers'>('ore');
  const [enrichedData, setEnrichedData] = useState<Map<string, {
    rounds_played: number;
    rounds_won: number;
    refined_ore: number;
    staked_ore: number;
  }>>(new Map());

  // Preload custom profile pictures on component mount
  useEffect(() => {
    const imagesToPreload = [
      '/colesseum.jpg',
      '/hhc.jpg',
      '/project0.jpg',
      '/oreguidelogo.png',
    ];
    const preloadedImages = new Set<string>();
    
    imagesToPreload.forEach((src) => {
      if (preloadedImages.has(src)) return;
      
      const img = new Image();
      img.onload = () => {
        preloadedImages.add(src);
      };
      img.onerror = () => {
        console.warn(`Failed to preload image: ${src}`);
      };
      img.src = src;
    });
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      let loadingTimeout: NodeJS.Timeout | null = null;
      try {
        setError(null);
        setLoading(true);
        
        // Set a timeout to prevent infinite loading
        loadingTimeout = setTimeout(() => {
          console.warn('Leaderboard fetch taking too long, checking if data was loaded...');
        }, 30000); // 30 second timeout warning
        
        if (displayMode === 'sol') {
          // Fetch SOL leaders from leaderboard endpoint
          const data = await getLeaderboard();
          
          if (data && Array.isArray(data)) {
            setLeaderboardData(data);
          } else {
            setError('Invalid data format received');
            setLeaderboardData([]);
          }
        } else if (displayMode === 'ore-total') {
          // For total ORE held mode, use Helius getTokenLargestAccounts to get top 20 holders
          // This gives us actual on-chain token balances (includes all ORE: staked, unrefined, refined, wallet)
          console.log('📊 Fetching top 20 ORE holders using getTokenLargestAccounts...');
          
          try {
            const topHolders = await getTopOreHolders(20); // Get top 20 holders (limit of getTokenLargestAccounts)
            
            if (!topHolders || topHolders.length === 0) {
              throw new Error('No holders data received from API');
            }
            
            // Map holders to leaderboard entry format
            // We need to merge with miner data for other stats, but total_ore_held comes from Helius
            let minersData: any[] = [];
            try {
              const miners = await getOreLeaders();
              if (miners && Array.isArray(miners)) {
                minersData = miners;
              }
            } catch (err) {
              console.warn('Failed to fetch miners data, continuing without it:', err);
              minersData = [];
            }
            
            const minerMap = new Map<string, any>();
            
            minersData.forEach((miner) => {
              minerMap.set(miner.authority, miner);
            });
            
            const mappedData: LeaderboardEntry[] = topHolders.map((holder) => {
              const miner = minerMap.get(holder.owner);
              const totalSolDeployed = miner?.total_deployed || 0;
              const lifetimeSolEarned = miner?.lifetime_rewards_sol || 0;
              const totalSolDeployedSOL = totalSolDeployed / LAMPORTS_PER_SOL;
              const lifetimeSolEarnedSOL = lifetimeSolEarned / LAMPORTS_PER_SOL;
              const netSolChange = lifetimeSolEarnedSOL - totalSolDeployedSOL;
              
              return {
                pubkey: holder.owner, // Use owner (wallet address) as pubkey
                rounds_played: 0,
                rounds_won: 0,
                total_sol_deployed: totalSolDeployed,
                total_sol_earned: lifetimeSolEarned,
                total_ore_earned: miner?.lifetime_rewards_ore || 0,
                unclaimed_ore: miner?.rewards_ore || 0,
                refined_ore: miner?.refined_ore || 0,
                staked_ore: undefined, // Not separately tracked in Helius data
                wallet_ore: undefined, // Not separately tracked in Helius data
                total_ore_held: holder.balance, // This is the actual on-chain token balance (includes everything)
                net_sol_change: netSolChange * LAMPORTS_PER_SOL,
                sol_balance_direction: netSolChange >= 0 ? 'up' : 'down',
              };
            });
            
            console.log('📊 Sample total ORE held data:', mappedData[0]);
            setLeaderboardData(mappedData);
          } catch (err) {
            console.error('Error fetching top holders:', err);
            throw err; // Re-throw to be caught by outer catch
          }
        } else if (displayMode === 'stakers') {
          // Top Stakers: Get top holders and fetch their staked ORE
          console.log('📊 Fetching top stakers...');
          const topHolders = await getTopOreHolders(20);
          
          // Fetch wallet balances for each holder to get staked_ore
          // Add delay between requests to avoid rate limiting
          const holdersWithStaked = [];
          for (let i = 0; i < topHolders.length; i++) {
            const holder = topHolders[i];
            try {
              // Add small delay between requests (100ms)
              if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              const balances = await getWalletBalances(holder.owner);
              const stakedOreString = balances.staked || '0';
              const stakedOre = parseFloat(stakedOreString) * ORE_CONVERSION_FACTOR;
              
              console.log(`📊 Staked ORE for ${holder.owner.slice(0, 6)}...: ${stakedOreString} ORE = ${stakedOre} smallest units`);
              
              holdersWithStaked.push({
                ...holder,
                staked_ore: stakedOre,
              });
            } catch (err) {
              console.warn(`Failed to fetch balances for ${holder.owner}:`, err);
              holdersWithStaked.push({
                ...holder,
                staked_ore: 0,
              });
            }
          }
          
          // Sort by staked_ore descending
          holdersWithStaked.sort((a, b) => (b.staked_ore || 0) - (a.staked_ore || 0));
          
          console.log('📊 Top stakers with balances:', holdersWithStaked.slice(0, 5).map(h => ({
            owner: h.owner.slice(0, 6) + '...',
            staked_ore: h.staked_ore / ORE_CONVERSION_FACTOR
          })));
          
          const minersData = await getOreLeaders();
          const minerMap = new Map<string, any>();
          
          if (minersData && Array.isArray(minersData)) {
            minersData.forEach((miner) => {
              minerMap.set(miner.authority, miner);
            });
          }
          
          const mappedData: LeaderboardEntry[] = holdersWithStaked.map((holder) => {
            const miner = minerMap.get(holder.owner);
            const totalSolDeployed = miner?.total_deployed || 0;
            const lifetimeSolEarned = miner?.lifetime_rewards_sol || 0;
            const totalSolDeployedSOL = totalSolDeployed / LAMPORTS_PER_SOL;
            const lifetimeSolEarnedSOL = lifetimeSolEarned / LAMPORTS_PER_SOL;
            const netSolChange = lifetimeSolEarnedSOL - totalSolDeployedSOL;
            
            return {
              pubkey: holder.owner,
              rounds_played: 0,
              rounds_won: 0,
              total_sol_deployed: totalSolDeployed,
              total_sol_earned: lifetimeSolEarned,
              total_ore_earned: miner?.lifetime_rewards_ore || 0,
              unclaimed_ore: miner?.rewards_ore || 0,
              refined_ore: miner?.refined_ore || 0,
              staked_ore: holder.staked_ore || 0, // Already in smallest units
              wallet_ore: undefined,
              total_ore_held: holder.balance,
              net_sol_change: netSolChange * LAMPORTS_PER_SOL,
              sol_balance_direction: netSolChange >= 0 ? 'up' : 'down',
            };
          });
          
          console.log('📊 Mapped stakers data:', mappedData.slice(0, 3).map(d => ({
            pubkey: d.pubkey.slice(0, 6) + '...',
            staked_ore: (d.staked_ore || 0) / ORE_CONVERSION_FACTOR
          })));
          
          setLeaderboardData(mappedData);
        } else {
          // Fetch ORE leaders from miners endpoint (for 'ore' mode - unrefined ORE)
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
                staked_ore: undefined,
                wallet_ore: undefined,
                total_ore_held: undefined,
                net_sol_change: netSolChange * LAMPORTS_PER_SOL,
                sol_balance_direction: netSolChange >= 0 ? 'up' : 'down',
              };
            });
            
            setLeaderboardData(mappedData);
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
        if (loadingTimeout) {
          clearTimeout(loadingTimeout);
        }
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [displayMode]);

  // Enrich data with profile information (rounds played, rounds won, refined ORE)
  useEffect(() => {
    const enrichData = async () => {
      if (leaderboardData.length === 0) return;
      
      const newEnrichedData = new Map<string, {
        rounds_played: number;
        rounds_won: number;
        refined_ore: number;
        staked_ore: number;
      }>();
      
      // Fetch profile data for top entries (limit to avoid too many requests)
      const topEntries = leaderboardData.slice(0, 20);
      
      await Promise.all(
        topEntries.map(async (entry) => {
          try {
            const profileData = await getProfileData(entry.pubkey);
            const rounds_played = profileData?.summary?.totalRounds 
              ? (typeof profileData.summary.totalRounds === 'string' ? parseInt(profileData.summary.totalRounds) : Number(profileData.summary.totalRounds))
              : (profileData?.rounds?.length || 0);
            const rounds_won = profileData?.summary?.totalWins 
              ? (typeof profileData.summary.totalWins === 'string' ? parseInt(profileData.summary.totalWins) : Number(profileData.summary.totalWins))
              : (profileData?.rounds?.filter((r: any) => r.isWinner === true).length || 0);
            
            // Get refined ORE from wallet balances if available
            let refined_ore = entry.refined_ore || 0;
            try {
              const balances = await getWalletBalances(entry.pubkey);
              refined_ore = parseFloat(balances.refined || '0') * ORE_CONVERSION_FACTOR;
            } catch (err) {
              // Use existing refined_ore if balances fetch fails
            }
            
            // Get staked ORE
            let staked_ore = entry.staked_ore || 0;
            if (!staked_ore) {
              try {
                const balances = await getWalletBalances(entry.pubkey);
                staked_ore = parseFloat(balances.staked || '0') * ORE_CONVERSION_FACTOR;
              } catch (err) {
                // Use existing staked_ore if balances fetch fails
              }
            }
            
            newEnrichedData.set(entry.pubkey, {
              rounds_played,
              rounds_won,
              refined_ore,
              staked_ore,
            });
          } catch (err) {
            // If profile fetch fails, use existing data
            newEnrichedData.set(entry.pubkey, {
              rounds_played: entry.rounds_played || 0,
              rounds_won: entry.rounds_won || 0,
              refined_ore: entry.refined_ore || 0,
              staked_ore: entry.staked_ore || 0,
            });
          }
        })
      );
      
      setEnrichedData(newEnrichedData);
    };

    enrichData();
  }, [leaderboardData]);

  const formatAddress = (address: string) => {
    if (!address) return 'N/A';
    // Show first 6 and last 6 characters
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatOre = (value: number) => {
    const oreValue = value / ORE_CONVERSION_FACTOR;
    return oreValue.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const sortedLeaderboardData = useMemo(() => {
    if (!leaderboardData.length) return [];
    
    if (displayMode === 'ore') {
      return [...leaderboardData].sort((a, b) => {
        const aOre = a.unclaimed_ore ?? 0;
        const bOre = b.unclaimed_ore ?? 0;
        return bOre - aOre;
      });
    } else if (displayMode === 'ore-total') {
      return [...leaderboardData].sort((a, b) => {
        const aTotal = a.total_ore_held ?? ((a.unclaimed_ore ?? 0) + (a.refined_ore ?? 0));
        const bTotal = b.total_ore_held ?? ((b.unclaimed_ore ?? 0) + (b.refined_ore ?? 0));
        return bTotal - aTotal;
      });
    } else if (displayMode === 'stakers') {
      return [...leaderboardData].sort((a, b) => {
        const aStaked = a.staked_ore ?? 0;
        const bStaked = b.staked_ore ?? 0;
        return bStaked - aStaked;
      });
    } else {
      return [...leaderboardData].sort((a, b) => {
        return b.net_sol_change - a.net_sol_change;
      });
    }
  }, [leaderboardData, displayMode]);

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Leaderboard</h1>
          <p className="text-slate-400 mb-4">
            {displayMode === 'ore'
              ? 'Ranked by unrefined ORE. Shows miners with the highest unrefined ORE rewards waiting to be refined.'
              : displayMode === 'ore-total'
              ? 'Top 20 ORE holders ranked by total ORE held (includes all token balances from on-chain data).'
              : displayMode === 'stakers'
              ? 'Top stakers ranked by staked ORE balance.'
              : 'Ranked by net SOL change (total SOL earned minus total SOL deployed). Shows all-time mining performance.'}
          </p>
          
          {/* Toggle Switch */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400">View by:</span>
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
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
                Top Miners
              </button>
              <button
                onClick={() => setDisplayMode('ore-total')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  displayMode === 'ore-total'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <img 
                  src="/orelogo.jpg" 
                  alt="ORE" 
                  className="w-4 h-4 rounded"
                />
                Top Holders
              </button>
              {/* Top Stakers filter hidden for now */}
              {/* <button
                onClick={() => setDisplayMode('stakers')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  displayMode === 'stakers'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <img 
                  src="/orelogo.jpg" 
                  alt="ORE" 
                  className="w-4 h-4 rounded"
                />
                Top Stakers
              </button> */}
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

        {/* Leaderboard Cards */}
        {loading ? (
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading Leaderboard data...</p>
          </div>
        ) : leaderboardData.length === 0 ? (
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-slate-400">No leaderboard data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedLeaderboardData.map((entry, index) => {
              const rank = index + 1;
              const address = String(entry.pubkey);
              const label = getWalletLabel(address);
              const fundingSources = getWalletFundingSources(address);
              const enriched = enrichedData.get(entry.pubkey) || {
                rounds_played: entry.rounds_played || 0,
                rounds_won: entry.rounds_won || 0,
                refined_ore: entry.refined_ore || 0,
                staked_ore: entry.staked_ore || 0,
              };
              
              // Use enriched data if available
              const refined_ore = enriched.refined_ore || entry.refined_ore || 0;
              const staked_ore = enriched.staked_ore || entry.staked_ore || 0;
              
              // Highlight only first place with different color
              const bgColor = rank === 1
                ? 'bg-yellow-900/30 border-yellow-700/50'
                : 'bg-slate-800/50 border-slate-700';
              
              // Main metric to display
              const mainMetric = displayMode === 'sol' 
                ? entry.net_sol_change / LAMPORTS_PER_SOL
                : displayMode === 'ore'
                ? (entry.unclaimed_ore || 0) / ORE_CONVERSION_FACTOR
                : displayMode === 'stakers'
                ? staked_ore / ORE_CONVERSION_FACTOR
                : (entry.total_ore_held || 0) / ORE_CONVERSION_FACTOR;
              
              return (
                <Link
                  key={String(entry.pubkey) || index}
                  to={`/my-profile?wallet=${String(entry.pubkey)}`}
                  className={`block ${bgColor} border rounded-lg p-4 hover:bg-opacity-70 transition-all`}
                >
                  <div className="flex items-center justify-between">
                    {/* Left side: Rank, Avatar, Address */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Rank Icon */}
                      <div className="flex-shrink-0">
                        {rank === 1 ? (
                          <span className="text-2xl">🏆</span>
                        ) : rank === 2 ? (
                          <span className="text-2xl">🥈</span>
                        ) : rank === 3 ? (
                          <span className="text-2xl">🥉</span>
                        ) : (
                          <span className="text-lg font-semibold text-slate-500">#{rank}</span>
                        )}
                      </div>
                      
                      {/* Avatar - Use custom profile picture for known wallets or default main site logo */}
                      <div className="flex-shrink-0">
                        {(() => {
                          const prefix = address.slice(0, 6);
                          const pfpSrc = SPECIAL_WALLET_PFPS[prefix] || '/oreguidelogo.png';
                          return (
                            <img
                              src={pfpSrc}
                              alt={label || 'Wallet'}
                              className={`w-10 h-10 rounded-full border-2 border-slate-600 ${
                                pfpSrc === '/oreguidelogo.png'
                                  ? 'object-contain p-1.5'
                                  : 'object-cover'
                              }`}
                              onError={(e) => {
                                console.warn(`Failed to load image: ${pfpSrc}`);
                                const img = e.currentTarget;
                                img.onerror = null; // Prevent infinite loop
                                img.src = '/oreguidelogo.png';
                                img.className =
                                  'w-10 h-10 rounded-full border-2 border-slate-600 object-contain p-1.5';
                              }}
                              loading="eager"
                            />
                          );
                        })()}
                      </div>
                      
                      {/* Wallet Address and Label */}
                      <div className="flex-1 min-w-0">
                        {/* Show wallet label above address for Top Holders mode if available */}
                        {displayMode === 'ore-total' && (() => {
                          const hasFundingSources = fundingSources && fundingSources.length > 0;
                          const description = !label && entry.total_ore_held 
                            ? getWalletDescription(String(entry.pubkey), (entry.total_ore_held || 0) / ORE_CONVERSION_FACTOR)
                            : null;
                          // Show label/description if we have one, OR if we have funding sources (meaning it's a known wallet)
                          if (label || description || hasFundingSources) {
                            return (
                              <>
                                <p className="text-lg font-bold text-slate-100 truncate mb-0.5">
                                  {label || description || 'Known Wallet'}
                                </p>
                                <p className="text-xs text-slate-400 truncate font-mono">
                                  {formatAddress(String(entry.pubkey))}
                                </p>
                              </>
                            );
                          }
                          // No label - show address normally
                          return (
                            <p className="text-base font-semibold text-slate-200 truncate">
                              {formatAddress(String(entry.pubkey))}
                            </p>
                          );
                        })()}
                        {/* For other modes, show address normally */}
                        {displayMode !== 'ore-total' && (
                          <p className="text-base font-semibold text-slate-200 truncate">
                            {formatAddress(String(entry.pubkey))}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Right side: Stats and Funding Sources */}
                    <div className="flex items-center gap-6 flex-shrink-0">
                      {/* Funding Sources - Only show for Top Holders mode */}
                      {displayMode === 'ore-total' && (() => {
                        const fundingSources = getWalletFundingSources(String(entry.pubkey));
                        if (fundingSources && fundingSources.length > 0) {
                          return (
                            <div className="text-right hidden lg:block">
                              <p className="text-xs text-slate-500 mb-1">Funded via</p>
                              <div className="flex flex-col gap-1 items-end">
                                {fundingSources.slice(0, 2).map((source, idx) => (
                                  <span key={idx} className="text-xs font-medium text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-700/50">
                                    {source.flowType || source.label}
                                  </span>
                                ))}
                                {fundingSources.length > 2 && (
                                  <span className="text-xs text-slate-500">
                                    +{fundingSources.length - 2} more
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                      {/* Main Metric */}
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">
                          {displayMode === 'sol' 
                            ? 'Net SOL' 
                            : displayMode === 'ore'
                            ? 'Unrefined ORE'
                            : displayMode === 'stakers'
                            ? 'Staked ORE'
                            : 'Total ORE'}
                        </p>
                        <div className="flex items-center gap-1.5 justify-end">
                          {displayMode === 'sol' ? (
                            <>
                              <SolanaLogo width={16} />
                              <span className={`text-lg font-bold ${
                                mainMetric >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {mainMetric >= 0 ? '+' : ''}{mainMetric.toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </span>
                            </>
                          ) : (
                            <>
                              <img 
                                src="/orelogo.jpg" 
                                alt="ORE" 
                                className="w-5 h-5 rounded"
                              />
                              <span className="text-lg font-bold text-green-400">
                                {mainMetric.toLocaleString('en-US', { 
                                  minimumFractionDigits: 2, 
                                  maximumFractionDigits: 2 
                                })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Refined ORE - Only show for non-ore-total modes */}
                      {displayMode !== 'ore-total' && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-slate-500 mb-1">Refined ORE</p>
                          <div className="flex items-center gap-1 justify-end">
                            <img 
                              src="/orelogo.jpg" 
                              alt="ORE" 
                              className="w-4 h-4 rounded"
                            />
                            <p className="text-base font-semibold text-slate-200">
                              {formatOre(refined_ore)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
