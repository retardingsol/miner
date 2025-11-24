// High-level session status reported by the backend bot
export type AutoMineSessionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'stopped'
  | 'completed'
  | 'error';

// One burner per main wallet – this is created once and reused
export interface BurnerInfo {
  mainWallet: string;
  burnerAddress: string;
}

// A mining session is a specific config (solPerBlock/blocks/rounds) using the wallet's burner
export interface AutoMineSession {
  sessionId: string;
  mainWallet: string;
  burnerAddress: string;
  status: AutoMineSessionStatus;
  // Optional telemetry from backend
  remainingSolLamports?: number;
  totalDeployedLamports?: number;
  roundsCompleted?: number;
  lastRoundId?: number;
  lastTxSig?: string;
  lastError?: string | null;
}

// Default backend base URL (Render service). Can be overridden with VITE_AUTOMINE_API_URL.
const DEFAULT_AUTOMINE_API_BASE = 'https://miner-x6do.onrender.com/automine';

const AUTOMINE_API_BASE =
  import.meta.env.VITE_AUTOMINE_API_URL || DEFAULT_AUTOMINE_API_BASE;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Automine API error ${res.status}: ${
        text ? text.slice(0, 200) : res.statusText
      }`,
    );
  }
  return res.json() as Promise<T>;
}

/**
 * Idempotently create or fetch the burner wallet for a main wallet.
 * Backend should:
 * - Generate a burner keypair on first call
 * - Persist mapping mainWallet -> burnerKeypair
 * - Return the same burnerAddress on subsequent calls
 */
export async function createOrGetBurner(
  mainWallet: string,
): Promise<BurnerInfo> {
  try {
    const res = await fetch(`${AUTOMINE_API_BASE}/burner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mainWallet }),
    });
    return handleResponse<BurnerInfo>(res);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(
        'Unable to reach mining bot backend. Make sure the automine service is deployed and VITE_AUTOMINE_API_URL is set.',
      );
    }
    throw err;
  }
}

/**
 * Create a new automine session for a wallet's burner.
 * Backend should:
 * - Look up burner by mainWallet
 * - Store config (solPerBlock, blocks, rounds)
 * - Return a session in 'pending' or 'ready' state
 */
export async function createAutoMineSession(params: {
  mainWallet: string;
  solPerBlock: number;
  blocks: number;
  rounds: number;
}): Promise<AutoMineSession> {
  try {
    const res = await fetch(`${AUTOMINE_API_BASE}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    return handleResponse<AutoMineSession>(res);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(
        'Unable to reach mining bot backend. Make sure the automine service is deployed and VITE_AUTOMINE_API_URL is set.',
      );
    }
    throw err;
  }
}

/**
 * Transition a session into 'running' state.
 * Backend should:
 * - Start or schedule the mining loop for this session
 */
export async function startAutoMineSession(
  sessionId: string,
): Promise<AutoMineSession> {
  try {
    const res = await fetch(`${AUTOMINE_API_BASE}/sessions/${sessionId}/start`, {
      method: 'POST',
    });
    return handleResponse<AutoMineSession>(res);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(
        'Unable to reach mining bot backend when starting session. Check VITE_AUTOMINE_API_URL and backend status.',
      );
    }
    throw err;
  }
}

/**
 * Stop a running session gracefully.
 * Backend should:
 * - Stop submitting new mining transactions
 * - Keep burner funds untouched so user can withdraw manually if desired
 */
export async function stopAutoMineSession(
  sessionId: string,
): Promise<AutoMineSession> {
  try {
    const res = await fetch(`${AUTOMINE_API_BASE}/sessions/${sessionId}/stop`, {
      method: 'POST',
    });
    return handleResponse<AutoMineSession>(res);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(
        'Unable to reach mining bot backend when stopping session. Check VITE_AUTOMINE_API_URL and backend status.',
      );
    }
    throw err;
  }
}

/**
 * Fetch latest status for a session (used for UI polling).
 */
export async function getAutoMineSession(
  sessionId: string,
): Promise<AutoMineSession> {
  try {
    const res = await fetch(`${AUTOMINE_API_BASE}/sessions/${sessionId}`, {
      method: 'GET',
    });
    return handleResponse<AutoMineSession>(res);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error(
        'Unable to reach mining bot backend when loading session. Check VITE_AUTOMINE_API_URL and backend status.',
      );
    }
    throw err;
  }
}


