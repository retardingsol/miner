import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const apiResponse = await fetch('https://refinorev2-production.up.railway.app/api/token/distribution');
    
    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({ error: 'Failed to fetch token distribution' });
    }

    const data = await apiResponse.json();
    
    // Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    return response.status(200).json(data);
  } catch (error) {
    console.error('Error fetching token distribution:', error);
    return response.status(500).json({ error: 'Internal server error' });
  }
}

