import { Connection } from '@solana/web3.js';

// Minimal ORE round state snapshot, used by the bot to know which round is active.

export interface OreStateSnapshot {
  roundId: number;
  status: 'idle' | 'active' | 'finished' | 'expired';
}

export async function getCurrentRound(_connection: Connection): Promise<OreStateSnapshot> {
  // Use the same v2 state endpoint and structure as the frontend getState() helper.
  const res = await fetch('https://ore-api.gmore.fun/v2/state');
  if (!res.ok) {
    throw new Error(`Failed to fetch ORE state: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();

  // v2 format: { frames: [{ roundId, liveData: {...}, ... }], globals: {...}, currentRoundId, ... }
  const frames: any[] = Array.isArray(data.frames) ? data.frames : [];

  if (!frames.length) {
    throw new Error('No round frames in ORE state response');
  }

  const currentFrame =
    frames.find((f) => String(f.roundId) === String(data.currentRoundId)) || frames[0];
  const liveData = currentFrame?.liveData || currentFrame?.round || currentFrame;

  if (!liveData) {
    throw new Error('No liveData in current ORE frame');
  }

  const roundId = parseInt(liveData.roundId ?? currentFrame.roundId ?? data.currentRoundId ?? '0', 10);
  const mining = liveData.mining || {};
  const status = (mining.status || 'idle') as OreStateSnapshot['status'];

  return { roundId, status };
}


