import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const apiResponse = await fetch('https://ore-api.gmore.fun/v2/bids');
    
    if (!apiResponse.ok) {
      return response.status(apiResponse.status).json({
        error: `Failed to fetch bids: ${apiResponse.status} ${apiResponse.statusText}`,
      });
    }

    const data = await apiResponse.json();
    return response.status(200).json(data);
  } catch (error: any) {
    console.error('Error proxying bids:', error);
    return response.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

