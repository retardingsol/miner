import { useState, useEffect, useMemo, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { SolanaLogo } from './SolanaLogo';
import {
  claimRewards,
  claimAllRewards,
  getMinerBalance,
  getAllBlocksMask,
  setupMiningAutomation,
  getMinerOreRewards,
  getAutomationInfo,
  stopMiningAutomation,
} from '../services/miningService';
import { getState } from '../services/api';
import {
  createOrGetBurner,
  getAutoMineSession,
  type AutoMineSession,
} from '../services/automineService';

interface AutoMinePanelProps {
  disabled?: boolean;
}

type RiskProfile = 'beginner' | 'balanced' | 'aggressive' | '67' | 'scotch pilgrim' | 'all25';

// Risk profile to blocks mapping
const RISK_PROFILE_BLOCKS: Record<RiskProfile, boolean[]> = {
  beginner: Array(25)
    .fill(false)
    .map((_, i) => i < 5), // First 5 blocks
  balanced: Array(25)
    .fill(false)
    .map((_, i) => i < 12), // First 12 blocks
  aggressive: Array(25)
    .fill(false)
    .map((_, i) => i < 18), // First 18 blocks
  '67': Array(25)
    .fill(false)
    .map((_, i) => [6, 7].includes(i)), // Blocks 6 and 7
  'scotch pilgrim': Array(25)
    .fill(false)
    .map((_, i) => [0, 1, 2, 3, 4, 20, 21, 22, 23, 24].includes(i)), // First and last 5
  all25: getAllBlocksMask(), // All 25 blocks
};

export function AutoMinePanel({ disabled = false }: AutoMinePanelProps) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, connected } = useWallet();

  const [solAmount, setSolAmount] = useState<number>(0);
  const [solAmountInput, setSolAmountInput] = useState<string>(''); // Start empty; placeholder guides the user
  const [blocks, setBlocks] = useState<number>(25);
  const [rounds, setRounds] = useState<number>(0);
  const [riskProfile] = useState<RiskProfile>('all25'); // Fixed to 'all25', unchangeable
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [minerBalance, setMinerBalance] = useState<BN>(new BN(0));
  // Dev-only automine backend state (kept for potential future use)
  const [burnerAddress, setBurnerAddress] = useState<string | null>(null);
  const [session, setSession] = useState<AutoMineSession | null>(null);
  const [autoMining, setAutoMining] = useState(false);
  const [unrefinedOre, setUnrefinedOre] = useState<number | null>(null);
  const [refinedOre, setRefinedOre] = useState<number | null>(null);
  const [automationInfo, setAutomationInfo] = useState<{
    exists: boolean;
    amount: BN;
    deposit: BN;
    fee: BN;
    mask: BN;
    strategy: number;
  } | null>(null);
  const [showClaimOreModal, setShowClaimOreModal] = useState(false);
  const [setupRentEstimateSol, setSetupRentEstimateSol] = useState(0);
  const [automationSettling, setAutomationSettling] = useState(false);
  const prevAutomationActiveRef = useRef(false);

  // Get current blocks based on risk profile
  const currentBlocks = RISK_PROFILE_BLOCKS[riskProfile];
  const actualBlocks = currentBlocks.filter((B) => B).length;

  // Update blocks count when risk profile changes
  useEffect(() => {
    setBlocks(actualBlocks);
  }, [riskProfile, actualBlocks]);

  // Derived automation state from on-chain Automation account
  const automationActive =
    automationInfo &&
    automationInfo.exists &&
    automationInfo.amount.gt(new BN(0)) &&
    automationInfo.deposit.gt(new BN(0));

  let automationRoundsRemaining = 0;
  let automationTotalPerRoundSol = 0;

  if (automationActive) {
    const amountLamports = automationInfo!.amount;
    const depositLamports = automationInfo!.deposit;
    const totalPerRoundLamports = amountLamports.mul(new BN(actualBlocks));
    if (totalPerRoundLamports.gt(new BN(0))) {
      automationRoundsRemaining = depositLamports.div(totalPerRoundLamports).toNumber();
      automationTotalPerRoundSol =
        totalPerRoundLamports.toNumber() / LAMPORTS_PER_SOL;
    }
  }

  // Fetch miner balance
  useEffect(() => {
    if (!connected || !publicKey) {
      setMinerBalance(new BN(0));
      return;
    }

    const fetchMinerInfo = async () => {
      try {
        const balance = await getMinerBalance(connection, publicKey);
        setMinerBalance(balance);
      } catch (err) {
        console.warn('Error fetching miner info:', err);
      }
    };

    fetchMinerInfo();
    const interval = setInterval(fetchMinerInfo, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  // After an automation finishes and the last deployed round has settled, force a
  // fresh miner balance read so the final round of SOL rewards is reflected
  // immediately instead of waiting for the next 30s poll.
  useEffect(() => {
    if (!connected || !publicKey) return;
    if (automationActive || automationSettling) return;

    (async () => {
      try {
        const balance = await getMinerBalance(connection, publicKey);
        setMinerBalance(balance);
      } catch (err) {
        console.warn('Error refreshing miner balance after automation settled:', err);
      }
    })();
  }, [automationActive, automationSettling, connected, publicKey, connection]);

  // Poll automation info so UI can reflect active automation state
  useEffect(() => {
    if (!connected || !publicKey) {
      setAutomationInfo(null);
      setAutomationSettling(false);
      return;
    }

    let cancelled = false;

    const fetchAutomation = async () => {
      try {
        const info = await getAutomationInfo(connection, publicKey);
        if (!cancelled) {
          setAutomationInfo(info);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('Error fetching automation info:', err);
          setAutomationInfo(null);
        }
      }
    };

    fetchAutomation();
    const interval = setInterval(fetchAutomation, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connected, publicKey, connection]);

  // Track when automation transitions from active -> inactive so we know to wait
  // for the last deployed round to finish before allowing a new automation.
  useEffect(() => {
    if (!connected || !publicKey) {
      prevAutomationActiveRef.current = false;
      setAutomationSettling(false);
      return;
    }

    const wasActive = prevAutomationActiveRef.current;
    const isActive = !!automationActive;

    // Detect falling edge: active -> inactive
    if (wasActive && !isActive) {
      setAutomationSettling(true);
    }

    prevAutomationActiveRef.current = isActive;
  }, [automationActive, connected, publicKey]);

  // While automation is settling, poll ORE state and wait until the current round
  // is no longer actively mining before we allow a new automation configuration.
  useEffect(() => {
    if (!automationSettling) return;

    let cancelled = false;

    const checkRoundStatus = async () => {
      try {
        const state = await getState();
        const status = state.round?.mining.status;

        if (!cancelled && status && status !== 'active') {
          // Last round has finished; it's safe to configure a new automation.
          setAutomationSettling(false);
        }
      } catch (err) {
        console.warn('Error checking round status for automation settle:', err);
      }
    };

    checkRoundStatus();
    const interval = setInterval(checkRoundStatus, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [automationSettling]);

  // Main wallet balance fetch was previously used for UI validation; it has
  // been removed to simplify the autominer panel and avoid unused state.

  // Estimate one-time rent-exempt SOL needed for Miner + Automation PDAs if they
  // do not already exist. This lets the Automate button show a total that more
  // closely matches the Phantom transaction amount.
  useEffect(() => {
    if (!connected || !publicKey) {
      setSetupRentEstimateSol(0);
      return;
    }

    let cancelled = false;

    const estimateRent = async () => {
      try {
        // Account sizes based on ORE IDL layout.
        const MINER_ACCOUNT_SIZE = 536;
        const AUTOMATION_ACCOUNT_SIZE = 112;

        // We reuse miningService helpers, which derive PDAs internally, by
        // asking for account info directly here.
        const minerAddress = (await import('../solana/oreSDK')).minerPDA(publicKey)[0];
        const automationAddress = (await import('../solana/oreSDK')).automationPDA(publicKey)[0];

        const [minerAccount, automationAccount] = await Promise.all([
          connection.getAccountInfo(minerAddress),
          connection.getAccountInfo(automationAddress),
        ]);

        let rentLamports = 0;

        if (!minerAccount) {
          rentLamports += await connection.getMinimumBalanceForRentExemption(
            MINER_ACCOUNT_SIZE,
          );
        }

        if (!automationAccount) {
          rentLamports += await connection.getMinimumBalanceForRentExemption(
            AUTOMATION_ACCOUNT_SIZE,
          );
        }

        if (!cancelled) {
          setSetupRentEstimateSol(rentLamports / LAMPORTS_PER_SOL);
        }
      } catch (err) {
        console.warn('Error estimating setup rent for autominer:', err);
        if (!cancelled) {
          setSetupRentEstimateSol(0);
        }
      }
    };

    estimateRent();

    return () => {
      cancelled = true;
    };
  }, [connected, publicKey, connection]);

  // Fetch ORE rewards (unrefined + refined) from on-chain Miner account via IDL
  useEffect(() => {
    if (!connected || !publicKey) {
      setUnrefinedOre(null);
      setRefinedOre(null);
      return;
    }

    const fetchOreRewards = async () => {
      try {
        const rewards = await getMinerOreRewards(connection, publicKey);
        if (rewards) {
          // On-chain rewards are stored as u64 with 11 decimal fixed point (same as profile pages)
          const ORE_CONVERSION_FACTOR = 1e11;
          setUnrefinedOre(rewards.rewardsOre.toNumber() / ORE_CONVERSION_FACTOR);
          setRefinedOre(rewards.refinedOre.toNumber() / ORE_CONVERSION_FACTOR);
        }
      } catch (err) {
        console.warn('Error fetching ORE rewards for autominer panel:', err);
        // Keep previously displayed rewards instead of clearing to avoid flicker.
      }
    };

    fetchOreRewards();
    const interval = setInterval(fetchOreRewards, 30000);
    return () => clearInterval(interval);
  }, [connected, publicKey, connection]);

  // Load burner / session from localStorage in dev so we can resume state between reloads
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!connected || !publicKey) {
      setBurnerAddress(null);
      setSession(null);
      setAutoMining(false);
      return;
    }
    const wallet = publicKey.toBase58();
    const burnerKey = `automine:burner:${wallet}`;
    const sessionKey = `automine:session:${wallet}`;
    const storedBurner = window.localStorage.getItem(burnerKey);
    const storedSession = window.localStorage.getItem(sessionKey);
    if (storedBurner) {
      setBurnerAddress(storedBurner);
    }
    if (storedSession) {
      try {
        const parsed: AutoMineSession = JSON.parse(storedSession);
        setSession(parsed);
        setAutoMining(parsed.status === 'running');
      } catch {
        // ignore parse errors
      }
    }

    // If no burner stored yet, auto-create one so the user can see it / fund it
    if (!storedBurner) {
      (async () => {
          try {
          const burnerInfo = await createOrGetBurner(wallet);
          setBurnerAddress(burnerInfo.burnerAddress);
          window.localStorage.setItem(burnerKey, burnerInfo.burnerAddress);
          } catch (err) {
          console.warn('Failed to auto-create burner for wallet:', err);
          }
      })();
    }
  }, [connected, publicKey]);

  const persistDevState = (wallet: string, burner: string | null, sess: AutoMineSession | null) => {
    if (!import.meta.env.DEV) return;
    const burnerKey = `automine:burner:${wallet}`;
    const sessionKey = `automine:session:${wallet}`;
    if (burner) {
      window.localStorage.setItem(burnerKey, burner);
    } else {
      window.localStorage.removeItem(burnerKey);
    }
    if (sess) {
      window.localStorage.setItem(sessionKey, JSON.stringify(sess));
    } else {
      window.localStorage.removeItem(sessionKey);
    }
  };

  // Poll session status while auto-mining in dev (hidden from UI, but keeps
  // backend state tidy during development)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!session || !autoMining) return;
    if (!publicKey) return;

    const wallet = publicKey.toBase58();

    const interval = setInterval(async () => {
      try {
        const latest = await getAutoMineSession(session.sessionId);

        // If the session has finished (completed/stopped/error),
        // clear it from UI and local dev state so the user can
        // start fresh with a new configuration.
        if (
          latest.status === 'completed' ||
          latest.status === 'stopped' ||
          latest.status === 'error'
        ) {
          setSession(null);
        setAutoMining(false);
          persistDevState(wallet, burnerAddress, null);
          return;
        }

        setSession(latest);
        setAutoMining(latest.status === 'running');
      } catch (err) {
        console.warn('Error polling automine session:', err);

        // If the backend no longer knows about this session (e.g. bot
        // restart, in-memory state lost), treat it as finished and
        // clear local dev state so the UI can start fresh.
        if (
          err instanceof Error &&
          (err.message.includes('404') ||
            err.message.includes('Session not found'))
        ) {
          setSession(null);
          setAutoMining(false);
          persistDevState(wallet, burnerAddress, null);
      }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [session, autoMining, publicKey, burnerAddress]);

  // Poll mining wallet balance in dev so user can see if it's funded
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!burnerAddress) {
      return;
    }
    const fetchBalance = async () => {
      try {
        const burnerPubkey = new PublicKey(burnerAddress);
        await connection.getBalance(burnerPubkey, 'confirmed');
      } catch (err) {
        console.warn('Error fetching burner balance:', err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [burnerAddress, connection]);

  // Calculate totals (SOL per block × blocks × rounds)
  const totalPerRound = useMemo(() => {
    return (solAmount || 0) * actualBlocks;
  }, [solAmount, actualBlocks]);

  const total = useMemo(() => {
    return totalPerRound * (rounds || 0);
  }, [totalPerRound, rounds]);

  const configurationLocked = automationActive || automationSettling;

  const formatSolDisplay = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '0';
    const fixed = value.toFixed(6); // show up to 6 decimals without rounding to fewer
    return fixed.replace(/0+$/, '').replace(/\.$/, '');
  };

  const minerBalanceSOL = minerBalance.toNumber() / LAMPORTS_PER_SOL;

  // Dev-only backend helpers have been removed from the live UI; production
  // autominer uses the main wallet with the official ORE executor.

  const handleClaimRewards = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet');
      return;
    }

    if (minerBalance.isZero()) {
      setError('No rewards available to claim');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signature = await claimRewards(connection, publicKey, signTransaction);

      const claimedSOL = minerBalanceSOL;
      setSuccess(
        `Claimed ${claimedSOL.toFixed(4)} SOL! Transaction: ${signature.slice(0, 8)}...`,
      );
      setMinerBalance(new BN(0));
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimAllRewards = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError('Please connect your wallet');
      return;
    }

    const totalOre = (unrefinedOre || 0) + (refinedOre || 0);
    if (minerBalance.isZero() && totalOre <= 0) {
      setError('No rewards available to claim');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signature = await claimAllRewards(connection, publicKey, signTransaction);
      setSuccess(
        `Claimed all rewards. Transaction: ${signature.slice(0, 8)}...`,
      );

      // Optimistically reset local reward state; polling hooks will refresh.
      setMinerBalance(new BN(0));
      setUnrefinedOre(0);
      setRefinedOre(0);
      setShowClaimOreModal(false);
    } catch (err) {
      console.error('Error claiming all rewards:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim all rewards');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAutomation = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError('Connect your wallet to configure auto-mining.');
      return;
    }

    if (solAmount <= 0 || rounds <= 0 || actualBlocks <= 0) {
      setError('Enter a valid SOL amount and round count.');
      return;
    }

    const lamports = await connection.getBalance(publicKey, 'confirmed');
    const walletSol = lamports / LAMPORTS_PER_SOL;
    const requiredSol = total;

    if (requiredSol > walletSol) {
      setError(
        `Not enough SOL in your wallet to deploy ${requiredSol.toFixed(
          6,
        )} SOL. Available balance: ${walletSol.toFixed(6)} SOL.`,
      );
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // amountPerBlock is per-square bet in lamports
      const amountPerBlockLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const rawDepositLamports =
        amountPerBlockLamports * actualBlocks * (rounds || 0);

      // Bake the one-time setup rent into the user's chosen deployment total by
      // reducing the automation deposit. The on-chain transaction will still pay
      // rent for new PDAs, but the effective deployed SOL will be approximately
      // (requiredSol - rent), so the wallet sees ~requiredSol (+ network fees).
      const estimatedRentLamports = Math.max(
        0,
        Math.floor(setupRentEstimateSol * LAMPORTS_PER_SOL),
      );
      const depositLamports = Math.max(rawDepositLamports - estimatedRentLamports, 0);

      await setupMiningAutomation(
        connection,
        publicKey,
        {
          amountPerBlock: new BN(amountPerBlockLamports),
          blocks: currentBlocks,
          deposit: new BN(depositLamports),
          fee: new BN(0),
          // Use dedicated executor wallet (donation wallet) so our backend bot
          // can drive Deploy transactions on behalf of this automation config.
          useDonationWallet: true,
        },
        signTransaction,
      );

      setSuccess(
        `Auto-mining automation configured for ${formatSolDisplay(
          requiredSol,
        )} SOL across ${rounds} round(s).`,
      );

      // Refresh automation info so UI immediately reflects active state
      try {
        const info = await getAutomationInfo(connection, publicKey);
        setAutomationInfo(info);
      } catch (err) {
        console.warn('Error refreshing automation info after setup:', err);
      }
    } catch (err) {
      console.error('Error configuring ORE automation:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to configure auto-mining automation.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStopAutomation = async () => {
    if (!connected || !publicKey || !signTransaction) {
      setError('Connect your wallet to stop automation.');
      return;
    }

    if (!automationActive) {
      // Nothing to stop
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signature = await stopMiningAutomation(connection, publicKey, signTransaction);
      setSuccess(`Automation stopped. Transaction: ${signature.slice(0, 8)}...`);

      // Refresh automation info so UI immediately reflects inactive state
      try {
        const info = await getAutomationInfo(connection, publicKey);
        setAutomationInfo(info);
      } catch (err) {
        console.warn('Error refreshing automation info after stop:', err);
        setAutomationInfo(null);
      }
    } catch (err) {
      console.error('Error stopping ORE automation:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to stop auto-mining automation.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#21252C] border border-slate-700 rounded-lg p-3 mb-4 relative">
      {/* Configuration inputs - hide while automation is running OR last round is settling */}
      {!configurationLocked && (
        <>
          {/* SOL Input Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SolanaLogo width={18} height={18} />
                <span className="text-sm font-semibold text-slate-200">SOL</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={solAmountInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow empty, just decimal point, or valid decimal numbers
                    if (val === '' || val === '.' || /^\d*\.?\d*$/.test(val)) {
                      setSolAmountInput(val);
                      // Update numeric value for calculations if valid
                      const num = parseFloat(val);
                      if (!isNaN(num) && num >= 0) {
                        setSolAmount(num);
                      } else if (val === '' || val === '.') {
                        setSolAmount(0);
                      }
                    }
                  }}
                  onBlur={(e) => { 
                    const val = e.target.value;
                    const num = parseFloat(val);
                    if (val === '' || isNaN(num) || num < 0) {
                      // Reset to "empty" state and rely on placeholder to prompt input
                      setSolAmount(0);
                      setSolAmountInput('');
                    } else {
                      // Format to remove trailing zeros but keep decimals
                      const formatted = num.toString();
                      setSolAmount(num);
                      setSolAmountInput(formatted);
                    }
                  }}
                  onFocus={(e) => {
                    // Select all on focus for easy editing
                    e.target.select();
                  }}
                  placeholder="0.001"
                  readOnly={false}
                  disabled={disabled || loading}
                  className="w-24 bg-transparent text-base font-semibold text-slate-200 placeholder:text-slate-500 outline-none text-right border-none focus:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Blocks Input Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-200">Blocks</span>
              </div>
              <input
                type="number"
                min={1}
                max={25}
                value={blocks === 0 ? '' : blocks}
                readOnly
                disabled
                className="w-24 bg-transparent text-base font-semibold text-slate-200 placeholder:text-slate-500 outline-none text-right border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none opacity-60 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Rounds Input Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-200">Rounds</span>
              </div>
              <input
                type="number"
                min={1}
                value={rounds === 0 ? '' : rounds}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setRounds(0);
                  } else {
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 1) {
                      setRounds(num);
                    }
                  }
                }}
                onBlur={(e) => { 
                  if (e.target.value === '' || parseInt(e.target.value, 10) < 1) {
                    setRounds(1);
                  }
                }}
                placeholder="1"
                readOnly={false}
                disabled={disabled || loading}
                className="w-24 bg-transparent text-base font-semibold text-slate-200 placeholder:text-slate-500 outline-none text-right border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Risk Profile Section */}
          <div className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                <span className="text-sm font-semibold text-slate-200">Risk profile</span>
              </div>
              <div className="relative">
                <select
                  value="all25"
                  disabled={true}
                  className="w-32 bg-transparent border-none text-base font-semibold text-slate-200 outline-none appearance-none disabled:opacity-60 disabled:cursor-not-allowed pr-6 text-right"
                >
                  <option value="all25">All 25 Blocks</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-slate-400 opacity-60">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Totals / Autominer summary */}
      <div className="mb-3">
        {automationActive ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Rounds remaining</span>
              <span className="text-sm font-semibold text-slate-200">
                {automationRoundsRemaining}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Total per round</span>
              <span className="text-sm font-semibold text-slate-200">
                {automationTotalPerRoundSol.toFixed(4)} SOL
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Total per round</span>
              <span className="text-sm font-semibold text-slate-200">
                {totalPerRound % 1 === 0 ? totalPerRound.toFixed(0) : totalPerRound.toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">Total ({rounds} rounds)</span>
              <span className="text-sm font-semibold text-slate-200">
                {total % 1 === 0 ? total.toFixed(0) : total.toFixed(4)} SOL
              </span>
            </div>
          </>
        )}
      </div>

      {/* Rewards summary (SOL + ORE) */}
      <div className="mb-3 mt-2 border border-slate-700 rounded-lg p-3 bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-100 mb-2">Rewards</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <SolanaLogo width={12} />
              <span>SOL</span>
            </span>
            <span className="font-semibold text-slate-100">
              {minerBalanceSOL.toFixed(6)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <img
                src="/orelogo.jpg"
                alt="ORE"
                className="w-3 h-3 object-contain rounded"
              />
              <span>Unrefined ORE</span>
            </span>
            <span className="font-semibold text-slate-100">
              {unrefinedOre !== null ? unrefinedOre.toFixed(8) : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <img
                src="/orelogo.jpg"
                alt="ORE"
                className="w-3 h-3 object-contain rounded"
              />
              <span>Refined ORE</span>
            </span>
            <span className="font-semibold text-slate-100">
              {refinedOre !== null ? refinedOre.toFixed(8) : '—'}
            </span>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2">
              <button
            type="button"
            onClick={handleClaimRewards}
            disabled={disabled || loading || !connected || minerBalanceSOL <= 0}
            className="w-full py-2 bg-white text-black hover:bg-slate-100 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-sm font-semibold rounded-full transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Claiming SOL...</span>
              </>
            ) : (
              <>
                <SolanaLogo width={16} height={16} />
                <span>Claim {minerBalanceSOL.toFixed(4)} SOL</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!connected || !publicKey) {
                setError('Connect your wallet to claim ORE.');
                return;
              }
              if ((unrefinedOre || 0) + (refinedOre || 0) <= 0) {
                setError('No ORE rewards available to claim.');
                return;
              }
              setShowClaimOreModal(true);
            }}
            disabled={
              disabled ||
              loading ||
              !connected ||
              ((unrefinedOre || 0) + (refinedOre || 0) <= 0)
            }
            className="w-full py-2 border border-white text-white hover:bg-white/10 disabled:border-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-sm font-semibold rounded-full transition-colors flex items-center justify-center gap-2"
              >
            <img
              src="/orelogo.jpg"
              alt="ORE"
              className="w-4 h-4 object-contain rounded"
            />
            <span>Claim all rewards</span>
              </button>
            </div>
          </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded">
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded">
          <p className="text-xs text-green-300">{success}</p>
        </div>
      )}

      {/* Claim ORE confirmation modal */}
      {showClaimOreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#111827] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Claim rewards</h3>
            <p className="text-xs text-slate-400 mb-4">
              Are you sure you want to claim all your mining rewards, including refined and unrefined ORE?
            </p>

            <div className="space-y-2 mb-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-2">
                  <SolanaLogo width={16} height={16} />
                  <span>SOL</span>
                </span>
                <span className="font-semibold text-white">
                  {minerBalanceSOL.toFixed(8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <img
                    src="/orelogo.jpg"
                    alt="ORE"
                    className="w-4 h-4 object-contain rounded"
                  />
                  <span>Unrefined ORE</span>
                </span>
                <span className="font-semibold text-slate-100">
                  {(unrefinedOre || 0).toFixed(8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-2">
                  <img
                    src="/orelogo.jpg"
                    alt="ORE"
                    className="w-4 h-4 object-contain rounded"
                  />
                  <span>Refined ORE</span>
                </span>
                <span className="font-semibold text-slate-100">
                  {(refinedOre || 0).toFixed(8)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleClaimAllRewards}
                className="w-full py-2 rounded-full bg-white text-black font-semibold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                <img
                  src="/orelogo.jpg"
                  alt="ORE"
                  className="w-4 h-4 object-contain rounded"
                />
                <span>Claim all rewards</span>
              </button>
              <button
                type="button"
                onClick={() => setShowClaimOreModal(false)}
                className="w-full py-2 rounded-full bg-transparent text-slate-300 font-semibold text-sm hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={
            automationActive
              ? handleStopAutomation
              : automationSettling
              ? undefined
              : handleSetupAutomation
          }
          disabled={
            disabled ||
            loading ||
            !connected ||
            automationSettling ||
            (automationActive ? false : total <= 0)
          }
          className="w-full py-2 bg-white text-black hover:bg-gray-100 disabled:bg-slate-800 disabled:text-slate-400 disabled:cursor-not-allowed text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <SolanaLogo width={16} height={16} />
          <span>
            {loading
              ? automationActive
                ? 'Stopping automation...'
                : automationSettling
                ? 'Waiting for settlement...'
                : 'Configuring automation...'
              : automationActive
              ? 'Stop autominer'
              : automationSettling
              ? 'Finishing current round...'
              : total > 0
              ? `Deploy ${formatSolDisplay(total)} SOL`
              : 'Enter SOL & rounds'}
          </span>
        </button>

        {/* Claim SOL now lives in the Rewards section above */}
      </div>
    </div>
  );
}


