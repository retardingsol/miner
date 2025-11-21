import { Connection, PublicKey } from '@solana/web3.js';

// Hard-code ORE board PDA if desired, or use API as a source of truth.
// For now we keep this minimal and lean on the public ORE v2 API.

export interface OreStateSnapshot {
  roundId: number;
  status: 'idle' | 'active' | 'finished' | 'expired';
}

export async function getCurrentRound(connection: Connection): Promise<OreStateSnapshot> {
  // Minimal implementation using ore-api.gmore.fun v2 endpoint
  const res = await fetch('https://ore-api.gmore.fun/v2/state');
  if (!res.ok) {
    throw new Error(`Failed to fetch ORE state: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const round = data.round || data.frames?.[0]?.liveData;
  if (!round) {
    throw new Error('No round data in ORE state response');
  }
  const roundId = parseInt(round.roundId ?? data.currentRoundId ?? '0', 10);
  const status = (round.mining?.status ?? 'idle') as OreStateSnapshot['status'];
  return { roundId, status };
}


