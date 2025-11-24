import { randomUUID } from 'crypto';
import type { BurnerRecord, SessionConfig, SessionStatus } from './types.js';

const burners = new Map<string, BurnerRecord>(); // mainWallet -> burner
const sessions = new Map<string, SessionConfig>(); // sessionId -> session

export function getOrCreateBurner(mainWallet: string, burnerAddress: string, burnerSecretBase58: string): BurnerRecord {
  const existing = burners.get(mainWallet);
  if (existing) return existing;
  const record: BurnerRecord = { mainWallet, burnerAddress, burnerSecretBase58 };
  burners.set(mainWallet, record);
  return record;
}

export function findBurner(mainWallet: string): BurnerRecord | undefined {
  return burners.get(mainWallet);
}

export function createSession(params: {
  mainWallet: string;
  burnerAddress: string;
  solPerBlockLamports: bigint;
  blocks: number;
  rounds: number;
  initialDepositLamports: bigint;
}): SessionConfig {
  // Disallow more than one active session per main wallet. An active
  // session is any that is not completed, stopped or errored.
  for (const existing of sessions.values()) {
    if (
      existing.mainWallet === params.mainWallet &&
      existing.status !== 'completed' &&
      existing.status !== 'stopped' &&
      existing.status !== 'error'
    ) {
      throw new Error('Active automine session already exists for this wallet');
    }
  }

  const now = Date.now();
  const sessionId = randomUUID();
  const session: SessionConfig = {
    sessionId,
    mainWallet: params.mainWallet,
    burnerAddress: params.burnerAddress,
    status: 'ready',
    solPerBlockLamports: params.solPerBlockLamports,
    blocks: params.blocks,
    rounds: params.rounds,
    roundsCompleted: 0,
    remainingSolLamports: params.initialDepositLamports,
    totalDeployedLamports: 0n,
    createdAt: now,
    updatedAt: now,
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(sessionId: string): SessionConfig | undefined {
  return sessions.get(sessionId);
}

export function updateSessionStatus(sessionId: string, status: SessionStatus, patch: Partial<SessionConfig> = {}): SessionConfig | undefined {
  const existing = sessions.get(sessionId);
  if (!existing) return undefined;
  const updated: SessionConfig = {
    ...existing,
    ...patch,
    status,
    updatedAt: Date.now(),
  };
  sessions.set(sessionId, updated);
  return updated;
}

export function listSessions(): SessionConfig[] {
  return Array.from(sessions.values());
}


