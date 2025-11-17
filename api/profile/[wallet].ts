import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract wallet from query params (Vercel populates this for [wallet] routes)
  const wallet = req.query.wallet as string;

  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address is required' });
  }

  try {
    const response = await fetch(
      `https://refinorev2-production.up.railway.app/api/profile/${wallet}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch profile data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

