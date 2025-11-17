import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    return response.status(200).end();
  }

  try {
    const apiResponse = await fetch('https://refinorev2-production.up.railway.app/api/liquidity/dex-breakdown');
    
    if (!apiResponse.ok) {
      response.status(apiResponse.status).json({ error: 'Failed to fetch liquidity DEX breakdown' });
      return;
    }
    
    const data = await apiResponse.json();
    
    // Set CORS headers
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    response.status(200).json(data);
  } catch (error) {
    console.error('Error fetching liquidity DEX breakdown:', error);
    response.status(500).json({ error: 'Internal server error' });
  }
}

