import {
  API_BASE_URL,
} from '../types/api';
import type {
  StateResponse,
  BidsResponse,
  HealthResponse,
  VersionResponse,
  RoundSnapshot,
  RoundResultSnapshot,
  TreasurySnapshot,
} from '../types/api';

/**
 * Retry fetch with exponential backoff for rate limiting
 */
async function fetchWithRetry(
  url: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url);
    
    if (response.status === 429 && attempt < maxRetries - 1) {
      // Rate limited - wait and retry with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }
    
    return response;
  }
  
  // Final attempt failed
  const finalResponse = await fetch(url);
  return finalResponse;
}

/**
 * Fetches the complete state snapshot from the ORE API
 * Transforms the new v2 API format to the expected StateResponse format
 */
export async function getState(): Promise<StateResponse> {
  // In development, use Vite proxy; in production, use serverless function
  const apiUrl = import.meta.env.DEV 
    ? '/api/ore-v2/state'      // Vite proxy (configured in vite.config.ts)
    : '/api/ore-api/v2/state'; // Vercel serverless function
  
  const response = await fetchWithRetry(apiUrl);
  
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Service unavailable. Both treasury and round snapshots are unavailable.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }
    throw new Error(`Failed to fetch state: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Transform v2 API format to expected StateResponse format
  // v2 format: { frames: [{ roundId, liveData: {...}, optimisticWinner, finalWinner }], globals: { treasury, currentSlot, orePrice, solPrice }, currentRoundId, latestFinalizedRoundId }
  
  const globals = data.globals || {};
  const frames = data.frames || [];
  
  // Get the current round (first frame is typically the current/active round)
  const currentFrame = frames.find((f: any) => f.roundId === data.currentRoundId) || frames[0];
  const liveData = currentFrame?.liveData;
  
  // Transform round data
  const round: RoundSnapshot | null = liveData ? {
    observedAt: liveData.observedAt || '',
    roundId: liveData.roundId || currentFrame.roundId || '',
    mining: {
      startSlot: liveData.mining?.startSlot || '0',
      endSlot: liveData.mining?.endSlot || '0',
      remainingSlots: liveData.mining?.remainingSlots || '0',
      status: (liveData.mining?.status || 'idle') as 'idle' | 'active' | 'finished' | 'expired',
    },
    uniqueMiners: liveData.uniqueMiners || '0',
    totals: {
      deployedSol: liveData.totals?.deployedSol || '0',
      vaultedSol: liveData.totals?.vaultedSol || '0',
      winningsSol: liveData.totals?.winningsSol || '0',
    },
    perSquare: {
      counts: liveData.perSquare?.counts || Array(25).fill('0'),
      deployedSol: liveData.perSquare?.deployedSol || Array(25).fill('0'),
    },
  } : null;
  
  // Transform round result (use finalWinner if available, otherwise optimisticWinner)
  const winner = currentFrame?.finalWinner || currentFrame?.optimisticWinner;
  const roundResult: RoundResultSnapshot | null = winner && winner.resultAvailable ? {
    roundId: winner.roundId || '',
    resultAvailable: winner.resultAvailable || false,
    status: winner.status || 'ready',
    winningSquareLabel: winner.winningSquareLabel || '',
    winningSquareIndex: winner.winningSquareIndex !== undefined ? winner.winningSquareIndex : undefined,
    motherlodeHit: winner.motherlodeHit || false,
    motherlodeFormatted: winner.motherlodeFormatted || '0',
    totalDeployedSol: winner.totalDeployedSol || '0',
    totalVaultedSol: winner.totalVaultedSol || '0',
    totalWinningsSol: winner.totalWinningsSol || '0',
    individualWinner: winner.topMiner || undefined,
    individualWinnerAddress: winner.topMiner && winner.topMiner !== '11111111111111111111111111111111' ? winner.topMiner : undefined,
  } : null;
  
  // Transform treasury
  const treasury: TreasurySnapshot | null = globals.treasury ? {
    observedAt: globals.treasury.observedAt || '',
    motherlodeFormatted: globals.treasury.motherlodeFormatted || '0',
  } : null;
  
  // Return transformed response
  return {
    treasury,
    round,
    currentSlot: globals.currentSlot || null,
    orePrice: globals.orePrice || null,
    solPrice: globals.solPrice || null,
    roundResult,
  };
}

/**
 * Fetches sorted list of miner deployments for the active round
 */
export async function getBids(): Promise<BidsResponse> {
  // In development, use Vite proxy; in production, use serverless function
  const apiUrl = import.meta.env.DEV 
    ? '/api/ore-v2/bids'       // Vite proxy (configured in vite.config.ts)
    : '/api/ore-api/v2/bids';  // Vercel serverless function
  
  const response = await fetchWithRetry(apiUrl);
  
  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }
    throw new Error(`Failed to fetch bids: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Transform v2 API format: the response has a nested structure
  // v2 format: { roundId: "...", bids: { roundId: "...", collectedAt: "...", uniqueMiners: ..., bids: [...] } }
  // Expected format: { roundId: "...", collectedAt: "...", uniqueMiners: ..., bids: [...] }
  if (data.bids && typeof data.bids === 'object' && !Array.isArray(data.bids)) {
    // If bids is an object (nested structure), extract it
    return {
      roundId: data.bids.roundId || data.roundId || '',
      collectedAt: data.bids.collectedAt || '',
      uniqueMiners: data.bids.uniqueMiners || 0,
      bids: Array.isArray(data.bids.bids) ? data.bids.bids : [],
    };
  }
  
  // Already in the expected format or has bids array directly
  return {
    roundId: data.roundId || '',
    collectedAt: data.collectedAt || '',
    uniqueMiners: data.uniqueMiners || 0,
    bids: Array.isArray(data.bids) ? data.bids : [],
  };
}

/**
 * Fetches health check status
 */
export async function getHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch health: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches backend version identifier
 */
export async function getVersion(): Promise<VersionResponse> {
  const response = await fetch(`${API_BASE_URL}/version`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch version: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches treasury snapshots from the treasury API
 */
export async function getTreasuries(): Promise<Array<{
  id: number;
  balance: number;
  motherlode: number;
  total_staked: number;
  total_unclaimed: number;
  total_refined: number;
  created_at: string;
}>> {
  const response = await fetch('https://kriptikz.dev/treasuries');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch treasuries: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches SOL balance for a wallet address using Solana RPC
 */
export async function getWalletBalance(address: string): Promise<number> {
  try {
    // Using public Solana RPC endpoint
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getBalance',
        params: [address],
      }),
    });
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Failed to fetch balance');
    }
    
    // Balance is returned in lamports, convert to SOL
    return data.result.value / 1e9;
  } catch (error) {
    // Silently handle wallet balance errors - they're not critical
    // The error is likely due to RPC rate limiting, CORS restrictions, or access forbidden
    // Re-throw to let the caller handle it gracefully
    throw error;
  }
}

/**
 * Fetches leaderboard data from the leaderboard API
 */
export async function getLeaderboard(): Promise<
  Array<{
  pubkey: string;
  rounds_played: number;
  rounds_won: number;
  total_sol_deployed: number;
  total_sol_earned: number;
  total_ore_earned: number;
  net_sol_change: number;
  sol_balance_direction: string;
  }>
> {
  try {
  const response = await fetch('https://kriptikz.dev/leaderboard/all-time');
  
  if (!response.ok) {
      throw new Error(
        `Failed to fetch leaderboard: ${response.status} ${response.statusText}`,
      );
  }
  
  return response.json();
  } catch (error) {
    // This data is non-critical for the app; log and return empty list so UI can still render.
    console.warn('getLeaderboard: failed to load leaderboard data', error);
    return [];
  }
}

/**
 * Fetches miner statistics for a specific wallet address
 */
export async function getMinerStats(walletAddress: string): Promise<{
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
}> {
  try {
    const response = await fetch(
      `https://kriptikz.dev/miner/latest/${walletAddress}`,
    );
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Miner not found');
    }
      throw new Error(
        `Failed to fetch miner stats: ${response.status} ${response.statusText}`,
      );
  }
  
  return response.json();
  } catch (error) {
    // Miner stats are now only used as soft fallback; on failure return a zeroed record.
    console.warn(
      `getMinerStats: failed to load miner stats for ${walletAddress}`,
      error,
    );
    return {
      authority: walletAddress,
      deployed: [],
      total_deployed: 0,
      cumulative: [],
      checkpoint_fee: 0,
      checkpoint_id: 0,
      last_claim_ore_at: 0,
      last_claim_sol_at: 0,
      rewards_sol: 0,
      rewards_ore: 0,
      refined_ore: 0,
      round_id: 0,
      lifetime_rewards_sol: 0,
      lifetime_rewards_ore: 0,
    };
  }
}

/**
 * Fetches ORE leaders from the miners API (sorted by unclaimed ORE)
 */
export async function getOreLeaders(): Promise<
  Array<{
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
  }>
> {
  try {
    const response = await fetch(
      'https://kriptikz.dev/miners?offset=0&order_by=unclaimed_ore',
    );
  
  if (!response.ok) {
      throw new Error(
        `Failed to fetch ORE leaders: ${response.status} ${response.statusText}`,
      );
  }
  
  return response.json();
  } catch (error) {
    // Non-critical: used only for rank badges. Fall back to empty list.
    console.warn('getOreLeaders: failed to load ORE leaders', error);
    return [];
  }
}

/**
 * Fetches miner history/time series data for graphs
 */
export async function getMinerHistory(walletAddress: string): Promise<Array<{
  timestamp: number;
  unclaimed_ore: number;
  refined_ore: number;
  lifetime_sol: number;
  lifetime_ore: number;
}>> {
  const response = await fetch(`https://kriptikz.dev/miner/history/${walletAddress}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      return []; // Return empty array if no history found
    }
    // Don't throw detailed errors for history - it's non-critical
    // Return empty array to allow the profile to still display
    if (response.status >= 500) {
      // Server errors - likely temporary
      return [];
    }
    throw new Error(`Failed to fetch miner history: ${response.status}`);
  }
  
  return response.json();
}

/**
 * Fetches rounds data for analytics
 */
export async function getRounds(): Promise<Array<{
  id: number;
  slot_hash: number[];
  winning_square: number;
  expires_at: number;
  motherlode: number;
  rent_payer: string;
  top_miner: string;
  top_miner_reward: number;
  total_deployed: number;
  total_vaulted: number;
  total_winnings: number;
  created_at: string;
}>> {
  const response = await fetch('https://kriptikz.dev/rounds');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch rounds: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches revenue history data from the revenue API
 */
export async function getRevenueHistory(): Promise<Array<{
  date: string;
  protocolRevenueSol: number;
  protocolRevenueUsd: number;
  adminFeeSol: number;
  adminFeeUsd: number;
  roundCount: number;
  emissionsValueUsd: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/revenue/history'
      : '/api/revenue/history';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch revenue history: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    return data.map((item: any) => ({
      date: item.date,
      protocolRevenueSol: parseFloat(item.protocolRevenueSol) || 0,
      protocolRevenueUsd: parseFloat(item.protocolRevenueUsd) || 0,
      adminFeeSol: parseFloat(item.adminFeeSol) || 0,
      adminFeeUsd: parseFloat(item.adminFeeUsd) || 0,
      roundCount: parseInt(item.roundCount) || 0,
      emissionsValueUsd: parseFloat(item.emissionsValueUsd) || 0,
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach revenue API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches SOL (Solana) market cap
 * Uses CoinGecko API
 */
export async function getSolMarketCap(): Promise<number> {
  try {
    // Use CoinGecko API to get SOL market cap
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_market_cap=true');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch SOL market cap: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    // Return SOL market cap in USD
    return data.solana?.usd_market_cap || 0;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach market cap API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches supply on market data for inflation tracking
 */
export async function getSupplyOnMarket(): Promise<{
  totalSupply: string;
  stakedTotal: string;
  unclaimedTotal: string;
  refinedTotal: string;
  supplyOnMarket: string;
  timestamp: string;
  isStale: boolean;
}> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/inflation/supply-on-market'
      : '/api/inflation/supply-on-market';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch supply on market: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach inflation API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches current inflation data (24h metrics)
 */
export async function getInflationCurrent(): Promise<{
  id: number;
  ts: string;
  totalSupply: string;
  emitted24h: string;
  withdrawn24h: string;
  buyback24h: string;
  netInflation24h: string;
  netMarketInflation24h: string;
  inflationRate: string;
}> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/inflation/current'
      : '/api/inflation/current';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch inflation current: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach inflation API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches 24h minted data
 */
export async function get24hMinted(): Promise<{
  roundCount: number;
  oreMinted: string;
  timeWindow: string;
  calculatedAt: string;
}> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/inflation/24h-minted'
      : '/api/inflation/24h-minted';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch 24h minted: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach inflation API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches net emissions data
 */
export async function getNetEmissions(days: number = 7): Promise<Array<{
  roundId: number;
  completedAt: string;
  emitted: number;
  buybackPotential: number;
  netEmission: number;
  protocolFeeSol: number;
  protocolFeeUsd: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? `/api/inflation/net-emissions?days=${days}`
      : `/api/inflation/net-emissions?days=${days}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch net emissions: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach inflation API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches current token metrics
 */
export async function getTokenCurrent(): Promise<{
  totalSupply: string;
  priceUsd: number;
  priceSol: number;
  marketCap: string;
  holders: number;
}> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? '/api/token/current'
      : '/api/token/current';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token current: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    return {
      totalSupply: data.totalSupply || '0',
      priceUsd: parseFloat(data.priceUsd) || 0,
      priceSol: data.solPriceUsd ? parseFloat(data.priceUsd) / parseFloat(data.solPriceUsd) : 0,
      marketCap: data.marketCap || '0',
      holders: data.holderCount || 0,
    };
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach token API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches token history (price and holder data)
 */
export async function getTokenHistory(hours: number = 168): Promise<Array<{
  timestamp: string;
  priceUsd: number;
  priceSol: number;
  holders: number;
}>> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? `/api/token/history?hours=${hours}`
      : `/api/token/history?hours=${hours}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token history: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    return data.map((item: any) => ({
      timestamp: item.ts || item.timestamp,
      priceUsd: parseFloat(item.priceUsd) || 0,
      priceSol: item.solPriceUsd ? parseFloat(item.priceUsd) / parseFloat(item.solPriceUsd) : 0,
      holders: item.holderCount || 0,
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach token API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches token holder distribution
 */
export async function getTokenDistribution(): Promise<Array<{
  range: string;
  holders: number;
  totalOre: string;
}>> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? '/api/token/distribution'
      : '/api/token/distribution';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch token distribution: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    return data.map((item: any) => ({
      range: item.rangeLabel || item.range,
      holders: item.holderCount || 0,
      totalOre: item.totalTokens || '0',
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach token API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches buyback wallet balance
 */
export async function getBuybackWalletBalance(): Promise<{
  wallet: string;
  balance: number;
  balanceLamports: number;
}> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? '/api/buyback-wallet/balance'
      : '/api/buyback-wallet/balance';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch buyback wallet balance: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach buyback API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches buyback balance history
 */
export async function getBuybackBalanceHistory(): Promise<Array<{
  timestamp: string;
  solSpent: number;
  oreBuried: number;
  stakingYield: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/inflation/buyback-balance-history'
      : '/api/inflation/buyback-balance-history';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch buyback balance history: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    return data.map((item: any) => ({
      timestamp: item.timestamp || item.ts || item.created_at || item.time,
      solSpent: parseFloat(item.solSpent || item.sol_spent || item.sol || 0),
      oreBuried: parseFloat(item.oreBuried || item.ore_buried || item.ore || 0),
      stakingYield: parseFloat(item.stakingYield || item.staking_yield || item.yield || 0),
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach buyback history API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches buyback transactions
 */
export async function getBuybacks(): Promise<Array<{
  timestamp: string;
  solSpent: number;
  oreBuried: number;
  stakingYield: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/inflation/buybacks'
      : '/api/inflation/buybacks';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch buybacks: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    // API returns: burnedAmount, stakingYield, solSpent, blockTime
    return data.map((item: any) => ({
      timestamp: item.blockTime || item.timestamp || item.ts || item.created_at || item.time || item.detectedAt,
      solSpent: parseFloat(item.solSpent || item.sol_spent || item.sol || 0),
      oreBuried: parseFloat(item.burnedAmount || item.oreBuried || item.ore_buried || item.ore || 0),
      stakingYield: parseFloat(item.stakingYield || item.staking_yield || item.yield || 0),
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach buybacks API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches liquidity history with price data
 */
export async function getLiquidityHistory(): Promise<Array<{
  timestamp: string;
  totalLiquidity: number;
  priceUsd: number;
  volume24h: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/liquidity/history'
      : '/api/liquidity/history';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch liquidity history: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    // API returns: ts, totalLiquidityUsd, priceUsd, volume24h
    return data.map((item: any) => ({
      timestamp: item.ts || item.timestamp || item.time || item.created_at,
      totalLiquidity: parseFloat(item.totalLiquidityUsd || item.totalLiquidity || item.liquidity || 0),
      priceUsd: parseFloat(item.priceUsd || item.price || 0),
      volume24h: parseFloat(item.volume24h || item.volume || 0),
    })).sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach liquidity history API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches current staking metrics
 */
export async function getStakingMetricsNow(): Promise<{
  asOf: string;
  L_7d: number;
  S_bar_7d: number;
  r_7d: number;
  r_24h: number;
  apr_annualized: number;
  actualDays: number;
  samples: {
    count: number;
    intervalSec: number;
  };
}> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/staking/metrics/now'
      : '/api/staking/metrics/now';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch staking metrics: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach staking metrics API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches staking metrics history
 */
export async function getStakingMetricsHistory(): Promise<Array<{
  date: string;
  apr: number;
  apy: number;
  dailyReturn: number;
  stakeFees: number;
  L_7d: number;
  S_bar_7d: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/staking/metrics/history'
      : '/api/staking/metrics/history';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch staking metrics history: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    // API returns: date, L_total, S_time_weighted, r_daily, apr_annualized
    return data.map((item: any) => ({
      date: item.date || item.timestamp || item.asOf,
      apr: parseFloat(item.apr_annualized || item.apr || 0),
      apy: 0, // Will be calculated from APR
      dailyReturn: parseFloat(item.r_daily || item.dailyReturn || item.r_24h || 0), // r_daily is decimal (0.00018873 = 0.018873%)
      stakeFees: parseFloat(item.L_total || item.stakeFees || item.L_7d || 0), // L_total is ORE amount
      L_7d: parseFloat(item.L_total || item.L_7d || 0),
      S_bar_7d: parseFloat(item.S_time_weighted || item.S_bar_7d || 0),
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach staking metrics history API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches DEX liquidity breakdown
 */
export async function getLiquidityDexBreakdown(): Promise<Array<{
  dexName: string;
  liquidityUsd: number;
  volume24h: number;
  poolCount: number;
  pools: Array<{
    pairAddress: string;
    liquidityUsd: number;
    volume24h: number;
  }>;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/liquidity/dex-breakdown'
      : '/api/liquidity/dex-breakdown';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch liquidity DEX breakdown: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    return data.map((item: any) => ({
      dexName: item.dexName || '',
      liquidityUsd: parseFloat(item.liquidityUsd || 0),
      volume24h: parseFloat(item.volume24h || 0),
      poolCount: parseInt(item.poolCount || 0),
      pools: (item.pools || []).map((pool: any) => ({
        pairAddress: pool.pairAddress || '',
        liquidityUsd: parseFloat(pool.liquidityUsd || 0),
        volume24h: parseFloat(pool.volume24h || 0),
      })),
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach liquidity DEX breakdown API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches current unrefined staking metrics
 */
export async function getUnrefinedMetricsNow(): Promise<{
  asOf: string;
  L_7d: number;
  U_bar_7d: number;
  r_7d: number;
  r_24h: number;
  apr_annualized: number;
  actualDays: number;
  samples: {
    count: number;
    intervalSec: number;
  };
}> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/metrics/now'
      : '/api/metrics/now';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch unrefined metrics: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach unrefined metrics API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches unrefined staking metrics history
 */
export async function getUnrefinedMetricsHistory(): Promise<Array<{
  date: string;
  apr: number;
  apy: number;
  dailyReturn: number;
  haircuts: number;
  L_7d: number;
  U_bar_7d: number;
}>> {
  try {
    // Use proxy in development, serverless function in production
    const apiUrl = import.meta.env.DEV 
      ? '/api/metrics/history'
      : '/api/metrics/history';
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch unrefined metrics history: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Map API response to expected format
    // API returns: date, L_total, U_time_weighted, r_daily, apr_annualized
    return data.map((item: any) => ({
      date: item.date || item.timestamp || item.asOf,
      apr: parseFloat(item.apr_annualized || item.apr || 0),
      apy: 0, // Will be calculated from APR
      dailyReturn: parseFloat(item.r_daily || item.dailyReturn || item.r_24h || 0), // r_daily is decimal (0.000834 = 0.0834%)
      haircuts: parseFloat(item.L_total || item.haircuts || item.L_7d || 0), // L_total is ORE amount
      L_7d: parseFloat(item.L_total || item.L_7d || 0),
      U_bar_7d: parseFloat(item.U_time_weighted || item.U_bar_7d || 0),
    }));
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach unrefined metrics history API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches profile data for a wallet address (includes rounds data and summary)
 */
export async function getProfileData(walletAddress: string): Promise<{
  wallet: string;
  rounds: Array<{
    roundId: string;
    deployedSol: string;
    deployedTiles: string[];
    oreEarned: string;
    solEarned: string;
    netSol: string;
    solPriceUsd: string;
    netUsd: string;
    isWinner: boolean;
    isSplit: boolean;
    hitMotherlode: boolean;
    motherlodeOre: string | null;
    winningTile: number;
    createdAt: string;
  }>;
  summary?: {
    totalRounds: number;
    totalWins: number;
    winRate: string;
    totalOreEarned: string;
    currentOreBalance: string;
    totalSolDeployed: string;
    totalSolEarned: string;
    netSol: string;
    avgSolPerRound: string;
    totalNetUsd: string;
    totalSolCostUsd: string;
    dataSource: string;
  };
}> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? `/api/profile/${walletAddress}`
      : `/api/profile/${walletAddress}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch profile data: ${response.status} ${response.statusText}. ${errorText.substring(0, 100)}`);
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Invalid response format. Expected JSON, got: ${contentType}. Response: ${text.substring(0, 200)}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach profile API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches wallet balances (unrefined, refined, staked, total)
 */
export async function getWalletBalances(walletAddress: string): Promise<{
  wallet: string;
  unrefined: string;
  refined: string;
  staked: string;
  total: string;
  dataSource: string;
}> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? `/api/profile/${walletAddress}/balances`
      : `/api/profile/${walletAddress}/balances`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch balances: ${response.status} ${response.statusText}. ${errorText.substring(0, 100)}`);
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      throw new Error(`Invalid response format. Expected JSON, got: ${contentType}. Response: ${text.substring(0, 200)}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach balances API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Fetches miners statistics data
 */
export async function getMinersData(timeframe: string = '3d'): Promise<{
  stats: {
    totalUnique: number;
    active: number;
    newToday: number;
    retentionRate: string;
  };
  uniqueOverTime: Array<{
    date: string;
    unique_miners: number;
  }>;
  newPerDay: Array<{
    date: string;
    new_miners: number;
  }>;
  newVsReturning: Array<{
    date: string;
    new_miners: number;
    returning_miners: number;
  }>;
  activityDistribution: Array<{
    count: number;
    category: string;
    percentage: number;
  }>;
  cohortDeployment: Array<{
    date: string;
    new_avg: string;
    returning_avg: string;
  }>;
  retentionFunnel: Array<{
    milestone: string;
    count: number;
    percentage: number;
  }>;
  topActive: Array<{
    wallet_address: string;
    total_rounds: number;
    win_count: number;
    win_rate: string;
    net_sol: string;
  }>;
}> {
  try {
    const apiUrl = import.meta.env.DEV 
      ? `/api/miners/all?timeframe=${timeframe}`
      : `/api/miners/all?timeframe=${timeframe}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch miners data: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error: Unable to reach miners API. This may be a CORS issue.');
    }
    throw error;
  }
}

/**
 * Get top ORE token holders using getTokenLargestAccounts (returns top 20)
 * This gives us the actual on-chain token balance (includes all ORE: staked, unrefined, refined, wallet)
 * Returns the top 20 largest token accounts and fetches their owner addresses
 */
export async function getTopOreHolders(limit: number = 20): Promise<Array<{
  address: string;
  balance: number; // In smallest ORE unit
  owner: string;
}>> {
  try {
    const HELIUS_API_KEY = '0979183a-9a9d-4b85-8278-3a82dae7e804';
    const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
    const ORE_MINT = 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp';
    
    console.log('📊 Fetching top 20 ORE holders using getTokenLargestAccounts...');
    
    // Use getTokenLargestAccounts which returns top 20 accounts
    const requestBody = {
      jsonrpc: '2.0',
      id: '1',
      method: 'getTokenLargestAccounts',
      params: [
        ORE_MINT,
        {
          commitment: 'finalized'
        }
      ],
    };
    
    const response = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status} ${response.statusText}`);
    }
    
    const responseText = await response.text();
    
    // Check if response is JSON
    if (!responseText.trim().startsWith('{')) {
      throw new Error(`Helius API returned non-JSON response: ${responseText.substring(0, 200)}`);
    }
    
    const data = JSON.parse(responseText);
    
    if (data.error) {
      throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
    }
    
    if (!data.result || !data.result.value) {
      throw new Error('Invalid response format from Helius API');
    }
    
    const tokenAccounts = data.result.value || [];
    
    // Fetch owner info for each token account
    const holdersWithOwners = await Promise.all(
      tokenAccounts.map(async (account: any) => {
        // Get account info to find owner
        const accountInfoRequest = {
          jsonrpc: '2.0',
          id: '1',
          method: 'getAccountInfo',
          params: [
            account.address,
            {
              encoding: 'jsonParsed',
            }
          ],
        };
        
        try {
          const accountResponse = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(accountInfoRequest),
          });
          
          const accountData = await accountResponse.json();
          
          let owner = '';
          // Extract owner from parsed account data
          if (accountData.result?.value?.data?.parsed?.info?.owner) {
            owner = accountData.result.value.data.parsed.info.owner;
          } else if (accountData.result?.value?.owner) {
            owner = accountData.result.value.owner;
          }
          
          // Parse amount - uiAmountString is already human-readable, but we need raw amount
          const amount = typeof account.amount === 'string' ? parseInt(account.amount, 10) : (account.amount || 0);
          
          return {
            address: account.address,
            balance: amount,
            owner: owner || account.address, // Fallback to address if owner not found
          };
        } catch (err) {
          console.warn(`Failed to fetch owner for ${account.address}:`, err);
          // Return with address as owner fallback
          const amount = typeof account.amount === 'string' ? parseInt(account.amount, 10) : (account.amount || 0);
          return {
            address: account.address,
            balance: amount,
            owner: account.address,
          };
        }
      })
    );
    
    // Filter out invalid entries and sort by balance
    const topHolders = holdersWithOwners
      .filter(h => h.address && h.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, Math.min(limit, 20)); // getTokenLargestAccounts only returns 20
    
    console.log(`📊 Found ${topHolders.length} top ORE holders`);
    if (topHolders.length > 0) {
      console.log('📊 Top holders:', topHolders.slice(0, 5));
    }
    
    return topHolders;
  } catch (error) {
    console.error('Error fetching top ORE holders:', error);
    throw error;
  }
}

