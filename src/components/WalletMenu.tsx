import { useState, useEffect, memo } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useNavigate } from 'react-router-dom';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SolanaLogo } from './SolanaLogo';
import { getWalletBalances, getHealth, getState, getBids, getMinerStats } from '../services/api';
import { getMinerOreRewards } from '../services/miningService';
import type { PriceSnapshot } from '../types/api';

// Loading indicator component
const LoadingIndicator = memo(() => (
  <div className="flex items-center gap-2">
    <div 
      className="rounded-full h-3 w-3 border-b-2 border-slate-400"
      style={{
        animation: 'spin 1s linear infinite',
        willChange: 'transform',
        animationFillMode: 'both'
      }}
    ></div>
  </div>
));

LoadingIndicator.displayName = 'LoadingIndicator';

interface WalletMenuProps {
  isOpen: boolean;
  onClose: () => void;
  solPrice: PriceSnapshot | null;
  orePrice: PriceSnapshot | null;
}

const DONATE_ADDRESS = '3copeQ922WcSc5uqZbESgZ3TrfnEA8UEGHJ4EvkPAtHS';
const ORE_CONVERSION_FACTOR = 1e11;

interface HealthStatus {
  overall: 'connected' | 'disconnected';
  state: {
    connected: boolean;
    responseTime: number | null;
    lastSuccess: Date | null;
  };
  bids: {
    connected: boolean;
    responseTime: number | null;
    lastSuccess: Date | null;
  };
  lastUpdated: Date | null;
}

const formatTimeAgo = (date: Date | null) => {
  if (!date) return 'Never';
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
};

export function WalletMenu({ isOpen, onClose, solPrice, orePrice }: WalletMenuProps) {
  const { publicKey, disconnect } = useWallet();
  const { connection } = useConnection();
  const navigate = useNavigate();
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solBalanceLoading, setSolBalanceLoading] = useState(true);
  const [oreBalances, setOreBalances] = useState<{
    wallet: string;
    staked: string;
    refined: string;
    unrefined: string;
    total: string;
  } | null>(null);
  const [oreBalancesLoading, setOreBalancesLoading] = useState(true);
  const [showDonateToast, setShowDonateToast] = useState(false);
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    overall: 'disconnected',
    state: { connected: false, responseTime: null, lastSuccess: null },
    bids: { connected: false, responseTime: null, lastSuccess: null },
    lastUpdated: null,
  });

  useEffect(() => {
    if (isOpen && publicKey) {
      // Reset loading states when opening menu
      setSolBalanceLoading(true);
      setOreBalancesLoading(true);
      // Fetch balances and check health in parallel
      fetchAllBalances();
      checkHealth();
    } else if (!isOpen) {
      // Reset state when menu closes for faster next open
      setSolBalance(null);
      setOreBalances(null);
      setSolBalanceLoading(true);
      setOreBalancesLoading(true);
    }
  }, [isOpen, publicKey]);

  useEffect(() => {
    if (isOpen) {
      // Check health every 10 seconds
      const interval = setInterval(checkHealth, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  const checkHealth = async () => {
    try {
      const health = await getHealth();
      
      // Check /state endpoint
      const stateStart = performance.now();
      try {
        await getState();
        const stateTime = ((performance.now() - stateStart) / 1000).toFixed(2);
          setHealthStatus(prev => ({
            ...prev,
            state: {
              connected: true,
              responseTime: parseFloat(stateTime),
              lastSuccess: new Date(),
            },
          }));
      } catch (e) {
        // State check failed
        setHealthStatus(prev => ({
          ...prev,
          state: {
            connected: false,
            responseTime: null,
            lastSuccess: prev.state.lastSuccess,
          },
        }));
      }

      // Check /bids endpoint
      const bidsStart = performance.now();
      try {
        await getBids();
        const bidsTime = ((performance.now() - bidsStart) / 1000).toFixed(2);
          setHealthStatus(prev => ({
            ...prev,
            bids: {
              connected: true,
              responseTime: parseFloat(bidsTime),
              lastSuccess: new Date(),
            },
          }));
      } catch (e) {
        // Bids check failed
        setHealthStatus(prev => ({
          ...prev,
          bids: {
            connected: false,
            responseTime: null,
            lastSuccess: prev.bids.lastSuccess,
          },
        }));
      }

      const overallConnected = health.hasTreasurySnapshot && health.hasRoundSnapshot;
      setHealthStatus(prev => ({
        ...prev,
        overall: overallConnected ? 'connected' : 'disconnected',
        lastUpdated: new Date(),
      }));
    } catch (error) {
      setHealthStatus(prev => ({
        ...prev,
        overall: 'disconnected',
      }));
    }
  };

  const fetchAllBalances = async () => {
    if (!publicKey) return;
    
    const address = publicKey.toBase58();
    
    // Fetch SOL balance first (fastest, most visible)
    connection.getBalance(publicKey)
      .then((balance) => {
        setSolBalance(balance / LAMPORTS_PER_SOL);
        setSolBalanceLoading(false);
      })
      .catch((error) => {
        console.error('Error fetching SOL balance:', error);
        setSolBalance(null);
        setSolBalanceLoading(false);
      });
    
    // Fetch ORE balances in parallel (can take longer, update when ready)
    setOreBalancesLoading(true);
    try {
      // Prefer direct on-chain Miner account rewards when available
      const rewards = await getMinerOreRewards(connection, publicKey);
      if (rewards) {
        const unrefined = rewards.rewardsOre.toNumber() / ORE_CONVERSION_FACTOR;
        const refined = rewards.refinedOre.toNumber() / ORE_CONVERSION_FACTOR;
        const wallet = 0;
        const staked = 0;
        const total = unrefined + refined + staked + wallet;

        setOreBalances({
          wallet: wallet.toString(),
          staked: staked.toString(),
          refined: refined.toString(),
          unrefined: unrefined.toString(),
          total: total.toString(),
        });
        setOreBalancesLoading(false);
        return;
      }
    } catch (onchainErr) {
      console.warn('Error fetching on-chain miner ORE rewards for wallet menu:', onchainErr);
    }

    // Fallback: use Refinore balances API, then legacy miner stats if needed
    getWalletBalances(address)
      .then((oreData) => {
        console.log('ORE balances fetched:', oreData);
        setOreBalances({
          wallet: oreData.wallet || '0',
          staked: oreData.staked || '0',
          refined: oreData.refined || '0',
          unrefined: oreData.unrefined || '0',
          total: oreData.total || '0',
        });
        setOreBalancesLoading(false);
      })
      .catch(async (error) => {
        console.error('Error fetching ORE balances:', error);
        // Fallback: approximate balances from miner stats so sidebar still shows something useful
        try {
          const stats = await getMinerStats(address);
          const unrefined =
            typeof stats.rewards_ore === 'number'
              ? stats.rewards_ore / ORE_CONVERSION_FACTOR
              : 0;
          const refined =
            typeof stats.refined_ore === 'number'
              ? stats.refined_ore / ORE_CONVERSION_FACTOR
              : 0;
          const wallet = 0;
          const staked = 0;
          const total = unrefined + refined + staked + wallet;

          setOreBalances({
            wallet: wallet.toString(),
            staked: staked.toString(),
            refined: refined.toString(),
            unrefined: unrefined.toString(),
            total: total.toString(),
          });
        } catch (fallbackErr) {
          console.error('Fallback miner stats for ORE balances also failed:', fallbackErr);
          // Final fallback: show zeros but stop the spinner
        setOreBalances({
          wallet: '0',
          staked: '0',
          refined: '0',
          unrefined: '0',
          total: '0',
        });
        } finally {
        setOreBalancesLoading(false);
        }
      });
  };

  if (!isOpen || !publicKey) return null;

  const address = publicKey.toBase58();
  
  // Generate default username from wallet address
  const defaultUsername = `${address.slice(0, 4)}...${address.slice(-4)}`;
  
  // Format ORE balance for display
  const formatOreBalance = (balance: string | null | undefined) => {
    if (!balance || balance === '0' || balance === '') return '0';
    const num = parseFloat(balance);
    if (isNaN(num) || num === 0) return '0';
    // For small balances, show more precision so they don't appear as "0"
    const fixed =
      Math.abs(num) < 1 ? num.toFixed(6) : num.toFixed(2);
    return fixed.replace(/\.?0+$/, '');
  };

  // Calculate total ORE accounting for 10% fee on unrefined when claiming
  const calculateTotalOre = () => {
    if (!oreBalances) return '0';
    
    const wallet = parseFloat(oreBalances.wallet) || 0;
    const staked = parseFloat(oreBalances.staked) || 0;
    const refined = parseFloat(oreBalances.refined) || 0;
    const unrefined = parseFloat(oreBalances.unrefined) || 0;
    
    // Unrefined has 10% fee when claiming, so value is 90% of unrefined amount
    const unrefinedAfterFee = unrefined * 0.9;
    
    const total = wallet + staked + refined + unrefinedAfterFee;
    return formatOreBalance(total.toString());
  };

  // Calculate portfolio value in USD
  const calculatePortfolioValue = () => {
    const solValue = solBalance && solPrice ? solBalance * parseFloat(solPrice.priceUsdRaw) : 0;
    const totalOreNum = parseFloat(calculateTotalOre()) || 0;
    const oreValue = orePrice ? totalOreNum * parseFloat(orePrice.priceUsdRaw) : 0;
    return solValue + oreValue;
  };

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(DONATE_ADDRESS);
      setShowDonateToast(true);
      setTimeout(() => {
        setShowDonateToast(false);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      const textArea = document.createElement('textarea');
      textArea.value = DONATE_ADDRESS;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setShowDonateToast(true);
        setTimeout(() => {
          setShowDonateToast(false);
        }, 3000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <>
      {/* Overlay with blur effect */}
      <div
        className={`fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm transition-opacity duration-700 ease-in-out ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      
      {/* Side Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-black border-l border-slate-700 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-slate-200">Wallet</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Profile Picture */}
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center">
                  <svg className="w-12 h-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                  </svg>
                </div>
                <button
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center hover:bg-slate-600 transition-colors"
                  aria-label="Change profile picture"
                >
                  <svg className="w-3.5 h-3.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Username */}
            <div className="mb-6 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-base font-medium text-slate-200">{defaultUsername}</span>
                <button
                  className="p-0.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  aria-label="Edit username"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* View Profile Button */}
            <div className="mb-6">
              <button
                onClick={() => {
                  navigate('/my-profile');
                  onClose();
                }}
                className="w-full bg-white text-black hover:bg-gray-100 rounded-full px-4 py-1.5 text-sm font-medium transition-colors"
              >
                View Profile
              </button>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-700 mb-4"></div>

            {/* Portfolio Value */}
            <div className="mb-4 p-3 bg-slate-800/50 border border-slate-600 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-slate-400">Portfolio Value</span>
                <span className="text-lg font-semibold text-white">
                  {(solBalanceLoading || oreBalancesLoading || !solPrice || !orePrice) ? (
                    <LoadingIndicator />
                  ) : (
                    `$${calculatePortfolioValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  )}
                </span>
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-700">
                {/* SOL Value */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SolanaLogo width={14} height={14} />
                    <span className="text-[10px] text-slate-500">SOL Value</span>
                  </div>
                  <span className="text-xs font-medium text-slate-300">
                    {solBalanceLoading || !solPrice || solBalance === null ? (
                      <LoadingIndicator />
                    ) : (
                      `$${(solBalance * parseFloat(solPrice.priceUsdRaw)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
                {/* ORE Value */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded-full bg-slate-700 flex items-center justify-center">
                      <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" />
                    </div>
                    <span className="text-[10px] text-slate-500">ORE Value</span>
                  </div>
                  <span className="text-xs font-medium text-slate-300">
                    {oreBalancesLoading || !orePrice ? (
                      <LoadingIndicator />
                    ) : (
                      `$${(parseFloat(calculateTotalOre()) * parseFloat(orePrice.priceUsdRaw)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              {/* SOL Balance */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SolanaLogo width={20} height={20} />
                  <span className="text-sm text-slate-400">SOL</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {solBalanceLoading ? (
                    <LoadingIndicator />
                  ) : solBalance !== null ? (
                    solBalance.toFixed(4)
                  ) : (
                    '0.0000'
                  )}
                </span>
              </div>

              {/* Wallet */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  </div>
                  <span className="text-sm text-slate-400">Wallet</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {oreBalancesLoading ? (
                    <LoadingIndicator />
                  ) : (
                    formatOreBalance(oreBalances?.wallet)
                  )}
                </span>
              </div>

              {/* Staked */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  </div>
                  <span className="text-sm text-slate-400">Staked</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {oreBalancesLoading ? (
                    <LoadingIndicator />
                  ) : (
                    formatOreBalance(oreBalances?.staked)
                  )}
                </span>
              </div>

              {/* Refined */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  </div>
                  <span className="text-sm text-slate-400">Refined</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {oreBalancesLoading ? (
                    <LoadingIndicator />
                  ) : (
                    formatOreBalance(oreBalances?.refined)
                  )}
                </span>
              </div>

              {/* Unrefined */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  </div>
                  <span className="text-sm text-slate-400">Unrefined</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {oreBalancesLoading ? (
                    <LoadingIndicator />
                  ) : (
                    formatOreBalance(oreBalances?.unrefined)
                  )}
                </span>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-700 my-3"></div>

              {/* Total */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  </div>
                  <span className="text-sm font-medium text-slate-300">Total</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-white">
                    {oreBalancesLoading ? (
                      <LoadingIndicator />
                    ) : (
                      calculateTotalOre()
                    )}
                  </span>
                  {!oreBalancesLoading && oreBalances && parseFloat(oreBalances.unrefined) > 0 && (
                    <span className="text-[10px] text-slate-500 mt-0.5 text-right max-w-[140px]">
                      (including 10% refinement fee incurred when claiming)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-700 space-y-2">
            {/* Connection Status and Donate Button Row */}
            <div className="flex items-center justify-between gap-2">
              {/* Connection Status Icon */}
              <div
                className="relative"
                onMouseEnter={() => setShowHealthTooltip(true)}
                onMouseLeave={() => setShowHealthTooltip(false)}
              >
                <div className="w-6 h-6 rounded border border-slate-600 flex items-center justify-center cursor-pointer hover:border-slate-500 transition-colors">
                  <div className={`w-3 h-3 rounded-full ${
                    healthStatus.overall === 'connected' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                </div>

                {/* Health Status Tooltip */}
                {showHealthTooltip && (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
                    <h3 className="text-sm font-semibold text-slate-300 mb-4 text-center">
                      CONNECTION STATUS
                    </h3>

                    {/* Overall Status */}
                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-700">
                      <span className="text-xs text-slate-400">Overall:</span>
                      <span className={`text-xs font-medium ${
                        healthStatus.overall === 'connected' ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {healthStatus.overall === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>

                    {/* /state Service */}
                    <div className="mb-3 pb-3 border-b border-slate-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400">/state:</span>
                        <span className={`text-xs font-medium ${
                          healthStatus.state.connected ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {healthStatus.state.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      {healthStatus.state.connected && (
                        <>
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Response:</span>
                            <span>{healthStatus.state.responseTime?.toFixed(2)}s</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Last success:</span>
                            <span>{formatTimeAgo(healthStatus.state.lastSuccess)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* /bids Service */}
                    <div className="mb-3 pb-3 border-b border-slate-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400">/bids:</span>
                        <span className={`text-xs font-medium ${
                          healthStatus.bids.connected ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {healthStatus.bids.connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      {healthStatus.bids.connected && (
                        <>
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Response:</span>
                            <span>{healthStatus.bids.responseTime?.toFixed(2)}s</span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Last success:</span>
                            <span>{formatTimeAgo(healthStatus.bids.lastSuccess)}</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Last Updated */}
                    <div className="flex justify-between items-center text-xs text-slate-500 mb-3 pb-3 border-b border-slate-700">
                      <span>Last updated:</span>
                      <span>{formatTimeAgo(healthStatus.lastUpdated)}</span>
                    </div>

                    {/* API Powered By */}
                    <div className="flex items-center justify-center gap-2 pt-2">
                      <a
                        href="https://gmore.fun"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                      >
                        <img 
                          src="/gmore-logo.webp" 
                          alt="gmore.fun" 
                          className="w-4 h-4"
                        />
                        API powered by <span className="text-slate-400">gmore.fun</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Donate Button */}
              <div className="relative flex-1">
                <button
                  onClick={handleCopyAddress}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-pink-400 border border-pink-500/30 transition-colors"
                  aria-label="Donate"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <span className="text-xs">donate</span>
                </button>

                {/* Donate Toast Notification */}
                {showDonateToast && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 px-4 py-2 bg-green-500/90 backdrop-blur-sm border border-green-400 rounded-lg shadow-xl z-50 animate-fade-in">
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <p className="text-xs font-medium text-white text-center">
                        SOL address copied for donation (thanks for supporting builders!)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={() => {
                disconnect();
                onClose();
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

