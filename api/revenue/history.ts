import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Credentials', 'true');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
  );

  if (request.method === 'OPTIONS') {
    response.status(200).end();
    return;
  }

  try {
    const apiResponse = await fetch('https://refinorev2-production.up.railway.app/api/revenue/history');
    
    if (!apiResponse.ok) {
      throw new Error(`Failed to fetch revenue history: ${apiResponse.status} ${apiResponse.statusText}`);
    }
    
    const data = await apiResponse.json();
    
    response.status(200).json(data);
  } catch (error) {
    console.error('Error fetching revenue history:', error);
    response.status(500).json({ 
      error: 'Failed to fetch revenue history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

