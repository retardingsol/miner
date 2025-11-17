import { useState, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { SolanaLogo } from './SolanaLogo';
import { useAutoMine, type AutoMineConfig, type UserVault, type UserConfig } from '../solana/automineProgram';
import BN from 'bn.js';

type RiskProfile = 'beginner' | 'balanced' | 'aggressive' | '67' | 'scotch pilgrim';

/**
 * Map risk profile to EV threshold (basis points) and num blocks
 * These values will be used by the backend bot with ore-ev-program
 */
function getRiskProfileConfig(profile: RiskProfile): { evThresholdBps: number; numBlocks: number } {
  switch (profile) {
    case 'beginner':
      // Conservative: require 2% positive EV, target 15 blocks (60% win chance)
      return { evThresholdBps: 200, numBlocks: 15 };
    case 'balanced':
      // Moderate: require 1% positive EV, target 13 blocks (52% win chance)
      return { evThresholdBps: 100, numBlocks: 13 };
    case 'aggressive':
      // Aggressive: require 0.5% positive EV, target 10 blocks (40% win chance)
      return { evThresholdBps: 50, numBlocks: 10 };
    case '67':
      // Custom profile: require 0.25% positive EV, target 7 blocks (28% win chance)
      return { evThresholdBps: 25, numBlocks: 7 };
    case 'scotch pilgrim':
      // Scotch Pilgrim's optimized profile: require 0.75% positive EV, target 12 blocks (48% win chance)
      return { evThresholdBps: 75, numBlocks: 12 };
  }
}

interface AutoMinePanelProps {
  disabled?: boolean;
}

export function AutoMinePanel({ disabled = false }: AutoMinePanelProps = {}) {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const {
    initUser,
    deposit,
    withdraw,
    updateConfig,
    fetchVault,
    fetchConfig,
    isReady,
  } = useAutoMine();

  const [solAmount, setSolAmount] = useState<number>(0); // 0 shows placeholder
  const [blocks, setBlocks] = useState<number>(0); // 0 shows placeholder
  const [rounds, setRounds] = useState<number>(0); // 0 shows placeholder
  const [maxSolPerRound, setMaxSolPerRound] = useState(0.1);
  const [maxTotalSol, setMaxTotalSol] = useState(1);
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('balanced');
  const [enabled, setEnabled] = useState(false);
  
  // State for on-chain data
  const [vault, setVault] = useState<UserVault | null>(null);
  const [, setConfig] = useState<UserConfig | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  // Fetch SOL balance
  useEffect(() => {
    if (connected && publicKey && connection) {
      const fetchBalance = async () => {
        try {
          // Balance fetching removed - not needed currently
          // const balance = await connection.getBalance(publicKey);
        } catch (err) {
          console.error('Error fetching SOL balance:', err);
        }
      };
      fetchBalance();
      const interval = setInterval(fetchBalance, 5000); // Update every 5 seconds
      return () => clearInterval(interval);
    }
  }, [connected, publicKey, connection]);

  // Fetch vault and config on mount and when wallet changes
  useEffect(() => {
    if (connected && isReady) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, isReady]);

  const loadData = async () => {
    if (!isReady) return;
    
    setLoading(true);
    setError(null);
    try {
      const [vaultData, configData] = await Promise.all([
        fetchVault(),
        fetchConfig(),
      ]);
      
      setVault(vaultData);
      setConfig(configData);
      setIsInitialized(configData !== null);
      
      // If config exists, sync UI state
      if (configData) {
        setMaxSolPerRound(configData.config.maxSolPerRound.toNumber() / 1e9);
        setMaxTotalSol(configData.config.maxTotalSol.toNumber() / 1e9);
        setEnabled(configData.config.enabled);
        // Map risk profile from config (0=beginner, 1=balanced, 2=aggressive, 3=67, 4=scotch pilgrim)
        const profiles: RiskProfile[] = ['beginner', 'balanced', 'aggressive', '67', 'scotch pilgrim'];
        setRiskProfile(profiles[configData.config.riskProfile] || 'balanced');
      }
    } catch (err) {
      console.error('Error loading automine data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load automine data');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (preset: RiskProfile) => {
    setRiskProfile(preset);
    if (preset === 'beginner') {
      setMaxSolPerRound(0.05);
      setMaxTotalSol(0.5);
    } else if (preset === 'balanced') {
      setMaxSolPerRound(0.1);
      setMaxTotalSol(1);
    } else if (preset === 'aggressive') {
      setMaxSolPerRound(0.2);
      setMaxTotalSol(2);
    } else if (preset === '67') {
      setMaxSolPerRound(0.3);
      setMaxTotalSol(3);
    } else if (preset === 'scotch pilgrim') {
      setMaxSolPerRound(0.15);
      setMaxTotalSol(1.5);
    }
  };

  const handleInitUser = async () => {
    if (!isReady) {
      setError('Wallet not connected');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signature = await initUser();
      setSuccess(`Initialized! Transaction: ${signature.slice(0, 8)}...`);
      setIsInitialized(true);
      // Reload data after initialization
      await loadData();
    } catch (err) {
      console.error('Error initializing user:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!isReady) {
      setError('Wallet not connected');
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signature = await deposit(amount);
      setSuccess(`Deposited ${amount} SOL! Transaction: ${signature.slice(0, 8)}...`);
      setDepositAmount('');
      await loadData();
    } catch (err) {
      console.error('Error depositing:', err);
      setError(err instanceof Error ? err.message : 'Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!isReady) {
      setError('Wallet not connected');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid withdraw amount');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const signature = await withdraw(amount);
      setSuccess(`Withdrew ${amount} SOL! Transaction: ${signature.slice(0, 8)}...`);
      setWithdrawAmount('');
      await loadData();
    } catch (err) {
      console.error('Error withdrawing:', err);
      setError(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!isReady) {
      setError('Wallet not connected');
      return;
    }

    if (!isInitialized) {
      setError('Please initialize your account first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const riskConfig = getRiskProfileConfig(riskProfile);
      const profileIndex = riskProfile === 'beginner' ? 0 : 
                           riskProfile === 'balanced' ? 1 : 
                           riskProfile === 'aggressive' ? 2 :
                           riskProfile === '67' ? 3 : 4;
      const configUpdate: Partial<AutoMineConfig> = {
        maxSolPerRound: new BN(maxSolPerRound * 1e9),
        maxTotalSol: new BN(maxTotalSol * 1e9),
        riskProfile: profileIndex,
        evThresholdBps: riskConfig.evThresholdBps,
        numBlocks: riskConfig.numBlocks,
        enabled,
      };

      const signature = await updateConfig(configUpdate);
      setSuccess(`Config saved! Transaction: ${signature.slice(0, 8)}...`);
      await loadData();
    } catch (err) {
      console.error('Error saving config:', err);
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setLoading(false);
    }
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Always show the full panel - disable when wallet not connected
  const isWalletConnected = connected && publicKey;
  const isPanelDisabled = disabled || !isWalletConnected;

  const vaultBalanceSol = vault ? vault.balance.toNumber() / 1e9 : 0;
  // Total per round = SOL amount × Blocks (use 0 if either is 0/empty)
  const totalPerRound = (solAmount || 0) * (blocks || 0);
  // Total = Total per round × Rounds (use 0 if rounds is 0/empty)
  const total = totalPerRound * (rounds || 0);

  const incrementSol = (amount: number) => {
    setSolAmount((prev) => {
      const current = prev || 0;
      return Math.max(0, current + amount);
    });
  };

  return (
    <div className="bg-[#111827] border border-emerald-600/60 rounded-lg p-3 mb-4 relative">

      {/* Status Messages */}
      {error && (
        <div className="mb-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-3 p-2 bg-green-500/20 border border-green-500/50 rounded text-xs text-green-300">
          {success}
        </div>
      )}

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
                disabled={isPanelDisabled}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold text-slate-300 rounded transition-colors"
              >
                +0.01
              </button>
              <button
                type="button"
                onClick={() => incrementSol(0.1)}
                disabled={isPanelDisabled}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold text-slate-300 rounded transition-colors"
              >
                +0.1
              </button>
              <button
                type="button"
                onClick={() => incrementSol(1)}
                disabled={isPanelDisabled}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] font-semibold text-slate-300 rounded transition-colors"
              >
                +1
              </button>
            </div>
            <input
              type="number"
              min={0}
              step={0.01}
              value={solAmount === 0 ? '' : solAmount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setSolAmount(0);
                } else {
                  const num = parseFloat(val);
                  if (!isNaN(num) && num >= 0) {
                    setSolAmount(num);
                  }
                }
              }}
              onBlur={(e) => { 
                if (e.target.value === '' || parseFloat(e.target.value) < 0) {
                  setSolAmount(0);
                }
              }}
              placeholder="1.0"
              readOnly={false}
              className="w-24 bg-transparent text-base font-semibold text-slate-200 placeholder:text-slate-500 outline-none text-right border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Blocks Input Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <span className="text-sm font-semibold text-slate-200">Blocks</span>
          </div>
          <input
            type="number"
            min={1}
            max={25}
            value={blocks === 0 ? '' : blocks}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') {
                setBlocks(0);
              } else {
                const num = parseInt(val);
                if (!isNaN(num) && num >= 1 && num <= 25) {
                  setBlocks(num);
                }
              }
            }}
            onBlur={(e) => { 
              if (e.target.value === '' || parseInt(e.target.value) < 1) {
                setBlocks(1);
              }
            }}
            placeholder="1"
            readOnly={false}
            className="w-24 bg-transparent text-base font-semibold text-slate-200 placeholder:text-slate-500 outline-none text-right border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:text-slate-100"
          />
        </div>
      </div>

      {/* Rounds Input Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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
                const num = parseInt(val);
                if (!isNaN(num) && num >= 1) {
                  setRounds(num);
                }
              }
            }}
            onBlur={(e) => { 
              if (e.target.value === '' || parseInt(e.target.value) < 1) {
                setRounds(1);
              }
            }}
            placeholder="1"
            readOnly={false}
            className="w-24 bg-transparent text-base font-semibold text-slate-200 placeholder:text-slate-500 outline-none text-right border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:text-slate-100"
          />
        </div>
      </div>

      {/* Risk Profile Section */}
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span className="text-sm font-semibold text-slate-200">Risk profile</span>
          </div>
          <div className="relative">
            <select
              value={riskProfile}
              onChange={(e) => handlePresetChange(e.target.value as RiskProfile)}
              disabled={isPanelDisabled || loading || !isInitialized}
              className="w-32 bg-transparent border-none text-base font-semibold text-slate-200 outline-none appearance-none disabled:opacity-50 disabled:cursor-not-allowed pr-6 text-right"
            >
              <option value="beginner">Beginner</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
              <option value="67">67</option>
              <option value="scotch pilgrim">Scotch Pilgrim</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="mb-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Total per round</span>
          <span className="text-xs font-semibold text-slate-200">
            {totalPerRound % 1 === 0 ? totalPerRound.toFixed(0) : totalPerRound.toFixed(1)} SOL
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Total</span>
          <span className="text-xs font-semibold text-slate-200">
            {total % 1 === 0 ? total.toFixed(0) : total.toFixed(1)} SOL
          </span>
        </div>
      </div>

      {/* Auto Mode Specific Settings */}
      <>
        {/* Vault Balance */}
        {isInitialized && (
          <div className="mb-2 p-1.5 bg-slate-900/60 border border-slate-700 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Vault Balance</span>
              <div className="flex items-center gap-1">
                <SolanaLogo width={12} />
                <span className="text-xs font-semibold text-slate-200">{vaultBalanceSol.toFixed(4)} SOL</span>
              </div>
            </div>
          </div>
        )}

        {/* Initialize Button */}
        {!isInitialized && (
          <button
            type="button"
            onClick={handleInitUser}
            disabled={isPanelDisabled || loading || !isReady}
            className="w-full mb-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Initializing...' : 'Initialize Auto-mine Account'}
          </button>
        )}

        {/* Deposit/Withdraw Section */}
        {isInitialized && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">Deposit</p>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700 rounded-lg px-1.5 py-1">
                <SolanaLogo width={10} />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="0.0"
                  readOnly={false}
                  className="bg-transparent text-[10px] text-slate-100 flex-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={handleDeposit}
                  disabled={isPanelDisabled || loading || !depositAmount || parseFloat(depositAmount) <= 0}
                  className="px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-semibold rounded transition-colors"
                >
                  {loading ? '...' : 'Deposit'}
                </button>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">Withdraw</p>
              <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-700 rounded-lg px-1.5 py-1">
                <SolanaLogo width={10} />
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.0"
                  readOnly={false}
                  className="bg-transparent text-[10px] text-slate-100 flex-1 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={isPanelDisabled || loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-semibold rounded transition-colors"
                >
                  {loading ? '...' : 'Withdraw'}
                </button>
              </div>
            </div>
          </div>
        )}


        {/* Save Config Button */}
        {isInitialized && (
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isPanelDisabled || loading}
            className="w-full mb-2 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        )}
      </>

      {loading && (
        <div className="mt-2 text-center">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
        </div>
      )}
    </div>
  );
}


