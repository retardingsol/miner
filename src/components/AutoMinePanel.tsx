import { useState, useEffect, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { SolanaLogo } from './SolanaLogo';
import {
  claimRewards,
  getMinerBalance,
  getAllBlocksMask,
} from '../services/miningService';

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

  const [solAmount, setSolAmount] = useState<number>(0.01);
  const [solAmountInput, setSolAmountInput] = useState<string>('0.01'); // String for input to allow typing
  const [blocks, setBlocks] = useState<number>(25);
  const [rounds, setRounds] = useState<number>(1);
  const [riskProfile] = useState<RiskProfile>('all25'); // Fixed to 'all25', unchangeable

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [minerBalance, setMinerBalance] = useState<BN>(new BN(0));

  // Get current blocks based on risk profile
  const currentBlocks = RISK_PROFILE_BLOCKS[riskProfile];
  const actualBlocks = currentBlocks.filter((B) => B).length;

  // Update blocks count when risk profile changes
  useEffect(() => {
    setBlocks(actualBlocks);
  }, [riskProfile, actualBlocks]);

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

  const incrementSol = (amount: number) => {
    setSolAmount((prev) => {
      const current = prev || 0;
      const newAmount = Math.max(0, current + amount);
      // Update input string to match
      setSolAmountInput(newAmount.toString());
      return newAmount;
    });
  };

  // Calculate totals (SOL per block × blocks × rounds)
  const totalPerRound = useMemo(() => {
    return (solAmount || 0) * actualBlocks;
  }, [solAmount, actualBlocks]);

  const total = useMemo(() => {
    return totalPerRound * (rounds || 0);
  }, [totalPerRound, rounds]);

  const minerBalanceSOL = minerBalance.toNumber() / LAMPORTS_PER_SOL;

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

  return (
    <div className="bg-[#21252C] border border-slate-700 rounded-lg p-3 mb-4 relative">
      {/* SOL Input Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SolanaLogo width={18} height={18} />
            <span className="text-sm font-semibold text-slate-200">SOL</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => incrementSol(0.01)}
                disabled={disabled || loading}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold text-slate-300 rounded transition-colors"
              >
                +0.01
              </button>
              <button
                type="button"
                onClick={() => incrementSol(0.1)}
                disabled={disabled || loading}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold text-slate-300 rounded transition-colors"
              >
                +0.1
              </button>
              <button
                type="button"
                onClick={() => incrementSol(1)}
                disabled={disabled || loading}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold text-slate-300 rounded transition-colors"
              >
                +1
              </button>
            </div>
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
                  setSolAmount(0.01);
                  setSolAmountInput('0.01');
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

      {/* Miner Balance & Status */}
      {minerBalanceSOL > 0 && (
        <div className="mb-3 p-2 bg-slate-900/50 rounded border border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Rewards available</span>
            <div className="flex items-center gap-1">
              <SolanaLogo width={12} height={12} />
              <span className="text-xs font-semibold text-green-400">
                {minerBalanceSOL.toFixed(4)} SOL
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Blocks</span>
          <span className="text-xs font-semibold text-slate-200">Random ×{actualBlocks}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Total per round</span>
          <span className="text-xs font-semibold text-slate-200">
            {totalPerRound % 1 === 0 ? totalPerRound.toFixed(0) : totalPerRound.toFixed(4)} SOL
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Total ({rounds} rounds)</span>
          <span className="text-xs font-semibold text-slate-200">
            {total % 1 === 0 ? total.toFixed(0) : total.toFixed(4)} SOL
          </span>
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

      {/* Action Buttons */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => {}}
          disabled={true}
          className="w-full py-2 bg-blue-600/50 hover:bg-blue-600/50 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Autominer Coming Soon</span>
        </button>

        {minerBalanceSOL > 0 && (
          <button
            type="button"
            onClick={handleClaimRewards}
            disabled={disabled || loading || !connected}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>Claiming...</span>
              </>
            ) : (
              <>
                <SolanaLogo width={14} height={14} />
                <span>Claim {minerBalanceSOL.toFixed(4)} SOL</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}


