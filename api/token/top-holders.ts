import type { VercelRequest, VercelResponse } from '@vercel/node';

const ORE_MINT = 'oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp';
const HELIUS_API_KEY = '0979183a-9a9d-4b85-8278-3a82dae7e804';
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Simple in-memory cache
let cache: {
  data: Array<{ address: string; balance: number; owner: string }>;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
    
    // Check cache first
    if (cache && Date.now() - cache.timestamp < CACHE_DURATION) {
      return res.status(200).json(cache.data.slice(0, limit));
    }
    
    console.log(`📊 Fetching top ${limit} ORE holders from Helius...`);
    
    // Simple direct call to Helius API
    const allHolders: Array<{ address: string; balance: number; owner: string }> = [];
    let page = 1;
    const pageSize = 1000;
    
    while (page <= 10 && allHolders.length < limit) {
      const requestBody = {
        jsonrpc: '2.0',
        id: '1',
        method: 'getTokenAccounts',
        params: {
          mint: ORE_MINT,
          page: page,
          limit: pageSize,
        },
      };
      
      const response = await fetch(HELIUS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const responseText = await response.text();
      
      if (!responseText.trim().startsWith('{')) {
        console.error('Helius returned non-JSON:', responseText.substring(0, 200));
        break;
      }
      
      const data = JSON.parse(responseText);
      
      if (data.error) {
        throw new Error(`Helius API error: ${JSON.stringify(data.error)}`);
      }
      
      if (!data.result || !data.result.token_accounts) {
        break;
      }
      
      const tokenAccounts = data.result.token_accounts || [];
      if (tokenAccounts.length === 0) break;
      
      // Map to our format
      const pageHolders = tokenAccounts.map((item: any) => ({
        address: item.address,
        balance: typeof item.amount === 'string' ? parseInt(item.amount, 10) : (item.amount || 0),
        owner: item.owner,
      })).filter((h: any) => h.address && h.owner && h.balance > 0);
      
      allHolders.push(...pageHolders);
      
      if (tokenAccounts.length < pageSize) break;
      page++;
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Group by owner
    const holderMap = new Map<string, { address: string; balance: number; owner: string }>();
    allHolders.forEach((holder) => {
      const existing = holderMap.get(holder.owner);
      if (existing) {
        existing.balance += holder.balance;
      } else {
        holderMap.set(holder.owner, { ...holder });
      }
    });
    
    // Sort and take top N
    const topHolders = Array.from(holderMap.values())
      .filter(h => h.balance > 0)
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 100);
    
    // Cache
    cache = {
      data: topHolders,
      timestamp: Date.now(),
    };
    
    return res.status(200).json(topHolders.slice(0, limit));
    
  } catch (error) {
    console.error('Error:', error);
    
    // Return cached data if available
    if (cache) {
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 100);
      return res.status(200).json(cache.data.slice(0, limit));
    }
    
    // Return error as JSON
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch top ORE holders' 
    });
  }
}
