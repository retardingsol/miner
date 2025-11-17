import {
  API_BASE_URL,
} from '../types/api';
import type {
  StateResponse,
  BidsResponse,
  HealthResponse,
  VersionResponse,
} from '../types/api';

/**
 * Fetches the complete state snapshot from the ORE API
 */
export async function getState(): Promise<StateResponse> {
  const response = await fetch(`${API_BASE_URL}/state`);
  
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error('Service unavailable. Both treasury and round snapshots are unavailable.');
    }
    throw new Error(`Failed to fetch state: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches sorted list of miner deployments for the active round
 */
export async function getBids(): Promise<BidsResponse> {
  const response = await fetch(`${API_BASE_URL}/bids`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch bids: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
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
export async function getLeaderboard(): Promise<Array<{
  pubkey: string;
  rounds_played: number;
  rounds_won: number;
  total_sol_deployed: number;
  total_sol_earned: number;
  total_ore_earned: number;
  net_sol_change: number;
  sol_balance_direction: string;
}>> {
  const response = await fetch('https://kriptikz.dev/leaderboard/all-time');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
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
  const response = await fetch(`https://kriptikz.dev/miner/latest/${walletAddress}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Miner not found');
    }
    throw new Error(`Failed to fetch miner stats: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

/**
 * Fetches ORE leaders from the miners API (sorted by unclaimed ORE)
 */
export async function getOreLeaders(): Promise<Array<{
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
}>> {
  const response = await fetch('https://kriptikz.dev/miners?offset=0&order_by=unclaimed_ore');
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ORE leaders: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
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

