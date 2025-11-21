/**
 * Price Service
 * 
 * Fetches ORE and SOL prices from Jupiter API
 * Based on ore_refined/src/price.rs
 */

interface PriceInfo {
  usdPrice: number;
  blockId: number;
  decimals: number;
  priceChange24h: number;
}

interface PriceResponse {
  [key: string]: PriceInfo;
}

/**
 * Get ORE and SOL prices from Jupiter API
 * Returns (ore_price, sol_price) in USD
 */
export async function getPrices(): Promise<[number, number]> {
  try {
    const url = 'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp';
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Price API error: ${response.status} ${response.statusText}`);
    }
    
    const data: PriceResponse = await response.json();
    
    const orePriceInfo = data['oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp'];
    const solPriceInfo = data['So11111111111111111111111111111111111111112'];
    
    if (!orePriceInfo || !solPriceInfo) {
      throw new Error('Failed to get prices from API response');
    }
    
    return [orePriceInfo.usdPrice, solPriceInfo.usdPrice];
  } catch (error) {
    console.error('Error fetching prices:', error);
    throw error;
  }
}

/**
 * Get prices with caching to avoid rate limiting
 */
let cachedPrices: [number, number] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 10000; // 10 seconds

export async function getCachedPrices(): Promise<[number, number]> {
  const now = Date.now();
  
  // Return cached prices if still valid
  if (cachedPrices && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedPrices;
  }
  
  // Fetch new prices
  const prices = await getPrices();
  cachedPrices = prices;
  cacheTimestamp = now;
  
  return prices;
}

