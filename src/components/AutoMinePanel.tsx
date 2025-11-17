import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { SolanaLogo } from './SolanaLogo';
import { useAutoMine, type AutoMineConfig, type UserVault, type UserConfig } from '../solana/automineProgram';
import BN from 'bn.js';

/**
 * Map risk profile to EV threshold (basis points) and num blocks
 * These values will be used by the backend bot with ore-ev-program
 */
function getRiskProfileConfig(profile: 'beginner' | 'balanced' | 'aggressive'): { evThresholdBps: number; numBlocks: number } {
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
  }
}

export function AutoMinePanel() {
  const { publicKey, connected } = useWallet();
  const {
    initUser,
    deposit,
    withdraw,
    updateConfig,
    fetchVault,
    fetchConfig,
    isReady,
  } = useAutoMine();

  const [maxSolPerRound, setMaxSolPerRound] = useState(0.1);
  const [maxTotalSol, setMaxTotalSol] = useState(1);
  const [riskProfile, setRiskProfile] = useState<'beginner' | 'balanced' | 'aggressive'>('balanced');
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
        // Map risk profile from config (0=beginner, 1=balanced, 2=aggressive)
        const profiles: ('beginner' | 'balanced' | 'aggressive')[] = ['beginner', 'balanced', 'aggressive'];
        setRiskProfile(profiles[configData.config.riskProfile] || 'balanced');
      }
    } catch (err) {
      console.error('Error loading automine data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load automine data');
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = (preset: 'beginner' | 'balanced' | 'aggressive') => {
    setRiskProfile(preset);
    if (preset === 'beginner') {
      setMaxSolPerRound(0.05);
      setMaxTotalSol(0.5);
    } else if (preset === 'balanced') {
      setMaxSolPerRound(0.1);
      setMaxTotalSol(1);
    } else {
      setMaxSolPerRound(0.2);
      setMaxTotalSol(2);
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
      const configUpdate: Partial<AutoMineConfig> = {
        maxSolPerRound: new BN(maxSolPerRound * 1e9),
        maxTotalSol: new BN(maxTotalSol * 1e9),
        riskProfile: riskProfile === 'beginner' ? 0 : riskProfile === 'balanced' ? 1 : 2,
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

  if (!connected || !publicKey) {
    return (
      <div className="bg-[#111827] border border-slate-700 rounded-lg p-4 mb-4">
        <p className="text-sm text-slate-300 mb-1 font-semibold">Auto-mine</p>
        <p className="text-xs text-slate-400">
          Connect your Phantom wallet using the button in the header to configure automatic ORE mining from this page.
        </p>
      </div>
    );
  }

  const vaultBalanceSol = vault ? vault.balance.toNumber() / 1e9 : 0;
  const riskConfig = getRiskProfileConfig(riskProfile);

  return (
    <div className="bg-[#111827] border border-emerald-600/60 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7 20h10a2 2 0 002-2V9.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0013.586 4H7a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-slate-200">Auto-mine</p>
            <p className="text-xs font-mono text-slate-400 truncate max-w-[260px]">
              {publicKey.toBase58()}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEnabled((prev) => !prev)}
          disabled={!isInitialized || loading}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            enabled
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
          }`}
        >
          {enabled ? 'Enabled' : 'Disabled'}
        </button>
      </div>

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

      {/* Vault Balance */}
      {isInitialized && (
        <div className="mb-3 p-2 bg-slate-900/60 border border-slate-700 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Vault Balance</span>
            <div className="flex items-center gap-1">
              <SolanaLogo width={14} />
              <span className="text-sm font-semibold text-slate-200">{vaultBalanceSol.toFixed(4)} SOL</span>
            </div>
          </div>
        </div>
      )}

      {/* Initialize Button */}
      {!isInitialized && (
        <button
          type="button"
          onClick={handleInitUser}
          disabled={loading || !isReady}
          className="w-full mb-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Initializing...' : 'Initialize Auto-mine Account'}
        </button>
      )}

      {/* Deposit/Withdraw Section */}
      {isInitialized && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <p className="text-xs text-slate-400 mb-1">Deposit</p>
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1.5">
              <SolanaLogo width={12} />
              <input
                type="number"
                min={0}
                step={0.01}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.0"
                disabled={loading}
                className="bg-transparent text-xs text-slate-100 flex-1 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleDeposit}
                disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
              >
                {loading ? '...' : 'Deposit'}
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-1">Withdraw</p>
            <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1.5">
              <SolanaLogo width={12} />
              <input
                type="number"
                min={0}
                step={0.01}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.0"
                disabled={loading}
                className="bg-transparent text-xs text-slate-100 flex-1 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleWithdraw}
                disabled={loading || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded transition-colors"
              >
                {loading ? '...' : 'Withdraw'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mb-3">
        This panel controls an on-chain AutoMine manager + backend bot that uses the{' '}
        <a
          href="https://github.com/scotchthepilgrim/ore-ev-program"
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-400 hover:text-emerald-300 underline"
        >
          ore-ev-program
        </a>{' '}
        to deploy optimally each round.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <p className="text-xs text-slate-400 mb-1">Max SOL per round</p>
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
            <SolanaLogo width={14} />
            <input
              type="number"
              min={0}
              step={0.01}
              value={maxSolPerRound}
              onChange={(e) => setMaxSolPerRound(parseFloat(e.target.value) || 0)}
              disabled={loading || !isInitialized}
              className="bg-transparent text-sm text-slate-100 flex-1 outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Max total SOL</p>
          <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
            <SolanaLogo width={14} />
            <input
              type="number"
              min={0}
              step={0.1}
              value={maxTotalSol}
              onChange={(e) => setMaxTotalSol(parseFloat(e.target.value) || 0)}
              disabled={loading || !isInitialized}
              className="bg-transparent text-sm text-slate-100 flex-1 outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Risk profile</p>
          <div className="flex gap-1">
            {(['beginner', 'balanced', 'aggressive'] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handlePresetChange(preset)}
                disabled={loading || !isInitialized}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-semibold capitalize border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  riskProfile === preset
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Risk Profile Details */}
      <div className="mb-3 p-2 bg-slate-900/40 border border-slate-700 rounded text-[10px] text-slate-400">
        <div className="flex justify-between items-center mb-1">
          <span>EV Threshold:</span>
          <span className="text-slate-300">{riskConfig.evThresholdBps / 100}%</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Target Blocks:</span>
          <span className="text-slate-300">{riskConfig.numBlocks} ({((riskConfig.numBlocks / 25) * 100).toFixed(0)}% win chance)</span>
        </div>
      </div>

      {/* Save Config Button */}
      {isInitialized && (
        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {loading ? 'Saving...' : 'Save Configuration'}
        </button>
      )}

      {loading && (
        <div className="mt-2 text-center">
          <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
        </div>
      )}
    </div>
  );
}


