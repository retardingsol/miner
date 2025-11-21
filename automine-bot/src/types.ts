import type { PublicKey } from '@solana/web3.js';

export type SessionStatus = 'pending' | 'ready' | 'running' | 'stopped' | 'completed' | 'error';

export interface BurnerRecord {
  mainWallet: string;
  burnerAddress: string;
  burnerSecretBase58: string; // stored encrypted in real deployment
}

export interface SessionConfig {
  sessionId: string;
  mainWallet: string;
  burnerAddress: string;
  status: SessionStatus;
  solPerBlockLamports: bigint;
  blocks: number;
  rounds: number;
  roundsCompleted: number;
  remainingSolLamports: bigint;
  totalDeployedLamports: bigint;
  lastRoundId?: number;
  lastTxSig?: string;
  lastError?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface OreStateSnapshot {
  roundId: number;
  status: 'idle' | 'active' | 'finished' | 'expired';
}

export interface BotContext {
  rpcUrl: string;
  connection: import('@solana/web3.js').Connection;
  oreProgramId: PublicKey;
}


