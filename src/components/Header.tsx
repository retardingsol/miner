import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PriceSnapshot } from '../types/api';
import { getHealth } from '../services/api';
import { SolanaLogo } from './SolanaLogo';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

type View = 'dashboard' | 'treasury' | 'leaderboard' | 'strategies' | 'merch' | 'inflation' | 'token' | 'revenue' | 'martingale' | 'staking' | 'liquidity' | 'unrefined' | 'what-is-ore';

interface HeaderProps {
  solPrice: PriceSnapshot | null;
  orePrice: PriceSnapshot | null;
  currentView?: View;
}

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

export function Header({ solPrice, orePrice, currentView = 'dashboard' }: HeaderProps) {
  const location = useLocation();
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({
    overall: 'disconnected',
    state: { connected: false, responseTime: null, lastSuccess: null },
    bids: { connected: false, responseTime: null, lastSuccess: null },
    lastUpdated: null,
  });
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDonateTooltip, setShowDonateTooltip] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [statsDropdownOpen, setStatsDropdownOpen] = useState(false);
  const [mobileStatsDropdownOpen, setMobileStatsDropdownOpen] = useState(false);
  const [stakingSubmenuOpen, setStakingSubmenuOpen] = useState(false);
  const [stakingSubmenuTimeout, setStakingSubmenuTimeout] = useState<number | null>(null);
  
  const DONATE_ADDRESS = '3copeQ922WcSc5uqZbESgZ3TrfnEA8UEGHJ4EvkPAtHS';

  // Determine current view from location if not provided
  const getCurrentView = (): View => {
    if (currentView) return currentView;
    const path = location.pathname;
    if (path === '/treasury') return 'treasury';
    if (path === '/inflation') return 'inflation';
    if (path === '/token') return 'token';
    if (path === '/revenue') return 'revenue';
    if (path === '/leaderboard') return 'leaderboard';
    if (path === '/strategies') return 'strategies';
    if (path === '/my-profile') return 'merch';
    if (path === '/martingale') return 'martingale';
    if (path === '/staking') return 'staking';
    if (path === '/liquidity') return 'liquidity';
    if (path === '/unrefined') return 'unrefined';
    if (path === '/what-is-ore') return 'what-is-ore';
    return 'dashboard';
  };

  const activeView = getCurrentView();

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(DONATE_ADDRESS);
      setAddressCopied(true);
      setTimeout(() => {
        setAddressCopied(false);
        setShowDonateTooltip(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      // Fallback: select the text
      const textArea = document.createElement('textarea');
      textArea.value = DONATE_ADDRESS;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setAddressCopied(true);
        setTimeout(() => {
          setAddressCopied(false);
          setShowDonateTooltip(false);
        }, 2000);
      } catch (fallbackErr) {
        console.error('Fallback copy failed:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  useEffect(() => {
    const checkHealth = async () => {
      const startTime = performance.now();
      try {
        const health = await getHealth();
        // Response time calculated but not used in current implementation
        void ((performance.now() - startTime) / 1000).toFixed(2);
        
        // Check /state endpoint
        const stateStart = performance.now();
        try {
          const stateResponse = await fetch('https://ore-api.gmore.fun/state');
          const stateTime = ((performance.now() - stateStart) / 1000).toFixed(2);
          if (stateResponse.ok) {
            setHealthStatus(prev => ({
              ...prev,
              state: {
                connected: true,
                responseTime: parseFloat(stateTime),
                lastSuccess: new Date(),
              },
            }));
          }
        } catch (e) {
          // State check failed
        }

        // Check /bids endpoint
        const bidsStart = performance.now();
        try {
          const bidsResponse = await fetch('https://ore-api.gmore.fun/bids');
          const bidsTime = ((performance.now() - bidsStart) / 1000).toFixed(2);
          if (bidsResponse.ok) {
            setHealthStatus(prev => ({
              ...prev,
              bids: {
                connected: true,
                responseTime: parseFloat(bidsTime),
                lastSuccess: new Date(),
              },
            }));
          }
        } catch (e) {
          // Bids check failed
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

    // Initial check
    checkHealth();

    // Check every 10 seconds
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatTimeAgo = (date: Date | null) => {
    if (!date) return 'Never';
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <header className="bg-black border-b border-slate-700 sticky top-0 z-50 min-h-[65px] flex items-center shrink-0">
      <div className="max-w-7xl mx-auto px-4 py-3 w-full flex items-center justify-between min-h-[65px]">
            {/* Logo and Navigation - left */}
            <div className="flex items-center gap-4 lg:gap-8 min-w-0 flex-shrink-0">
              <Link
                to="/"
                className="hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1.5">
                  <img 
                    src="/oreguidelogo.png" 
                    alt="ORE Guide" 
                    className="h-10 w-auto object-contain cursor-pointer flex-shrink-0"
                  />
                </div>
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-2">
              <Link
                to="/my-profile"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeView === 'merch'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                My Profile
              </Link>
              <Link
                to="/leaderboard"
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeView === 'leaderboard'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Leaderboard
              </Link>
              <div 
                className="relative"
                onMouseEnter={() => setStatsDropdownOpen(true)}
                onMouseLeave={() => setStatsDropdownOpen(false)}
              >
                <button
                  onClick={() => setStatsDropdownOpen(!statsDropdownOpen)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    ['treasury', 'inflation', 'token', 'revenue', 'strategies', 'staking', 'liquidity', 'unrefined', 'martingale'].includes(activeView)
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Statistics
                  <svg 
                    className={`w-4 h-4 transition-transform ${statsDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {statsDropdownOpen && (
                  <div 
                    className="absolute top-full left-0 pt-1 w-48 z-50"
                    onMouseEnter={() => {
                      // Clear timeout when re-entering main dropdown
                      if (stakingSubmenuTimeout) {
                        clearTimeout(stakingSubmenuTimeout);
                        setStakingSubmenuTimeout(null);
                      }
                      setStatsDropdownOpen(true);
                    }}
                    onMouseLeave={(e) => {
                      // Check if we're moving to the staking submenu
                      const relatedTarget = e.relatedTarget as HTMLElement;
                      if (relatedTarget && (relatedTarget.closest('.staking-submenu-container') || relatedTarget.closest('.staking-menu-item'))) {
                        // Moving to staking submenu or parent item, keep dropdown open
                        return;
                      }
                      // Close submenu and dropdown
                      setStakingSubmenuOpen(false);
                      if (stakingSubmenuTimeout) {
                        clearTimeout(stakingSubmenuTimeout);
                        setStakingSubmenuTimeout(null);
                      }
                      setStatsDropdownOpen(false);
                    }}
                  >
                    <div className="bg-black border-2 border-slate-600 rounded-lg shadow-xl">
                    <Link
                      to="/treasury"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors rounded-t-lg block ${
                        activeView === 'treasury'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Treasury
                    </Link>
                    <Link
                      to="/revenue"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors block ${
                        activeView === 'revenue'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Revenue
                    </Link>
                    <Link
                      to="/token"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors block ${
                        activeView === 'token'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Token
                    </Link>
                    <Link
                      to="/liquidity"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors block ${
                        activeView === 'liquidity'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Liquidity
                    </Link>
                    <Link
                      to="/inflation"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors block ${
                        activeView === 'inflation'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Inflation
                    </Link>
                    <div 
                      className="relative staking-menu-item"
                      onMouseEnter={() => {
                        // Clear any pending timeout
                        if (stakingSubmenuTimeout) {
                          clearTimeout(stakingSubmenuTimeout);
                          setStakingSubmenuTimeout(null);
                        }
                        setStakingSubmenuOpen(true);
                        // Keep parent dropdown open
                        setStatsDropdownOpen(true);
                      }}
                      onMouseLeave={() => {
                        // Add a delay before closing to allow movement to submenu
                        // The submenu will clear this timeout if mouse enters it
                        const timeout = window.setTimeout(() => {
                          setStakingSubmenuOpen(false);
                        }, 300);
                        setStakingSubmenuTimeout(timeout);
                      }}
                    >
                      <div
                        className={`w-full px-4 py-2 text-left text-sm transition-colors flex items-center justify-between ${
                          ['staking', 'unrefined'].includes(activeView)
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <span>APR</span>
                        <svg 
                          className={`w-4 h-4 transition-transform ${stakingSubmenuOpen ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                      {stakingSubmenuOpen && (
                        <div 
                          className="staking-submenu-container absolute left-full top-0 w-48 z-50"
                          onMouseEnter={() => {
                            // Clear timeout when entering submenu - this prevents closing
                            if (stakingSubmenuTimeout) {
                              clearTimeout(stakingSubmenuTimeout);
                              setStakingSubmenuTimeout(null);
                            }
                            setStakingSubmenuOpen(true);
                            // Keep parent dropdown open
                            setStatsDropdownOpen(true);
                          }}
                          onMouseLeave={() => {
                            // Close immediately when leaving submenu (not going back to parent)
                            setStakingSubmenuOpen(false);
                          }}
                          style={{ marginLeft: '-8px', paddingLeft: '8px' }}
                        >
                          <div className="bg-black border-2 border-slate-600 rounded-lg shadow-xl">
                            <Link
                              to="/staking"
                              onClick={() => {
                                setStatsDropdownOpen(false);
                                setStakingSubmenuOpen(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm transition-colors rounded-t-lg block ${
                                activeView === 'staking'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              Staking
                            </Link>
                            <Link
                              to="/unrefined"
                              onClick={() => {
                                setStatsDropdownOpen(false);
                                setStakingSubmenuOpen(false);
                              }}
                              className={`w-full px-4 py-2 text-left text-sm transition-colors rounded-b-lg block ${
                                activeView === 'unrefined'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              Unrefined
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                    <Link
                      to="/strategies"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors block ${
                        activeView === 'strategies'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Strategies / SoV
                    </Link>
                    <Link
                      to="/martingale"
                      onClick={() => setStatsDropdownOpen(false)}
                      className={`w-full px-4 py-2 text-left text-sm transition-colors rounded-b-lg block ${
                        activeView === 'martingale'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      Martingale Sim
                    </Link>
                      </div>
                  </div>
                )}
              </div>
            </nav>
        </div>

        {/* Prices and Health - right */}
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-6 flex-shrink-0">
          {/* Solana Price */}
          {solPrice && (
            <a
              href="https://jup.ag/tokens/So11111111111111111111111111111111111111112"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
            >
              <SolanaLogo width={20} className="sm:w-6" />
              <span className="text-slate-200 font-medium whitespace-nowrap text-sm sm:text-base">
                ${parseFloat(solPrice.priceUsdRaw).toFixed(2)}
              </span>
            </a>
          )}

          {/* ORE Price */}
          {orePrice && (
            <a
              href="https://jup.ag/tokens/oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
            >
              <img 
                src="/orelogo.jpg" 
                alt="ORE" 
                className="w-4 h-4 sm:w-5 sm:h-5 object-contain rounded flex-shrink-0"
              />
              <span className="text-slate-200 font-medium whitespace-nowrap text-sm sm:text-base">
                ${parseFloat(orePrice.priceUsdRaw).toFixed(2)}
              </span>
            </a>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>

          {/* X/Twitter Link */}
          <a
            href="https://x.com/oredotmonster"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            aria-label="Follow us on X"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>

          {/* Wallet connect (Phantom) */}
          <div className="hidden sm:block">
            <WalletMultiButton className="!bg-slate-800 !border !border-slate-600 !text-slate-100 hover:!bg-slate-700 !rounded-lg !px-3 !py-1.5 !text-xs" />
          </div>

          {/* Donate Button */}
          <div
            className="relative hidden sm:block"
            onMouseEnter={() => !addressCopied && setShowDonateTooltip(true)}
            onMouseLeave={() => !addressCopied && setShowDonateTooltip(false)}
          >
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 transition-colors border border-pink-500/30 hover:border-pink-500/50"
              aria-label="Donate"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="text-xs">donate</span>
            </button>

            {/* Donate Tooltip */}
            {(showDonateTooltip || addressCopied) && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                      <h3 className="text-sm font-semibold text-slate-300">
                        Donate to ORE Builders
                      </h3>
                </div>
                {addressCopied ? (
                  <div className="text-center py-2">
                    <p className="text-sm font-medium text-green-400 mb-2">
                      ✓ Address copied to clipboard!
                    </p>
                    <p className="text-xs text-slate-400">
                      All donations go directly to supporting builders in the ORE ecosystem.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-3">
                      All donations go directly to supporting builders in the ORE ecosystem. Click to copy the address.
                    </p>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-600">
                      <p className="text-xs text-slate-400 mb-1">SOL Address:</p>
                      <p className="text-sm font-mono text-pink-400 break-all select-all">
                        {DONATE_ADDRESS}
                      </p>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 text-center">
                      Click the button to copy
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Health Endpoint Indicator */}
          <div
            className="relative hidden sm:block"
            onMouseEnter={() => setShowHealthTooltip(true)}
            onMouseLeave={() => setShowHealthTooltip(false)}
          >
            <div className="w-8 h-8 rounded border-2 border-blue-500 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors">
              <div className={`w-4 h-4 rounded-full ${
                healthStatus.overall === 'connected' ? 'bg-blue-500' : 'bg-red-500'
              }`}></div>
            </div>

            {/* Health Status Tooltip */}
            {showHealthTooltip && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-4 z-50">
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
                <div className="flex justify-between items-center text-xs text-slate-500">
                  <span>Last updated:</span>
                  <span>{formatTimeAgo(healthStatus.lastUpdated)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu - Slides from right */}
      <>
        {/* Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

          {/* Slide-out menu */}
          <div
              className={`fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-black border-l border-slate-700 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
              mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex flex-col h-full">
              {/* Menu Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-slate-200">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Menu Items */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                <Link
                  to="/my-profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${
                    activeView === 'merch'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  My Profile
                </Link>
                <Link
                  to="/leaderboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${
                    activeView === 'leaderboard'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Leaderboard
                </Link>
                <div className="space-y-1">
                  <button
                    onClick={() => setMobileStatsDropdownOpen(!mobileStatsDropdownOpen)}
                    className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center justify-between gap-3 ${
                      ['treasury', 'inflation', 'token', 'revenue', 'strategies', 'staking', 'liquidity', 'unrefined', 'martingale'].includes(activeView)
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Statistics
                    </div>
                    <svg 
                      className={`w-5 h-5 transition-transform flex-shrink-0 ${mobileStatsDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {mobileStatsDropdownOpen && (
                    <div className="pl-4 space-y-1">
                      <Link
                        to="/treasury"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'treasury'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Treasury
                      </Link>
                      <Link
                        to="/revenue"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'revenue'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Revenue
                      </Link>
                      <Link
                        to="/token"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'token'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Token
                      </Link>
                      <Link
                        to="/liquidity"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'liquidity'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Liquidity
                      </Link>
                      <Link
                        to="/inflation"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'inflation'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Inflation
                      </Link>
                      <div className="space-y-1">
                        <button
                          onClick={() => setStakingSubmenuOpen(!stakingSubmenuOpen)}
                          className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors flex items-center justify-between ${
                            ['staking', 'unrefined'].includes(activeView)
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                          }`}
                        >
                          <span>APR</span>
                          <svg 
                            className={`w-4 h-4 transition-transform flex-shrink-0 ${stakingSubmenuOpen ? 'rotate-90' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                        {stakingSubmenuOpen && (
                          <div className="pl-4 space-y-1">
                            <Link
                              to="/staking"
                              onClick={() => {
                                setMobileMenuOpen(false);
                                setStakingSubmenuOpen(false);
                              }}
                              className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                                activeView === 'staking'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              Staking
                            </Link>
                            <Link
                              to="/unrefined"
                              onClick={() => {
                                setMobileMenuOpen(false);
                                setStakingSubmenuOpen(false);
                              }}
                              className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                                activeView === 'unrefined'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                              }`}
                            >
                              Unrefined
                            </Link>
                          </div>
                        )}
                      </div>
                      <Link
                        to="/strategies"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'strategies'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Strategies / SoV
                      </Link>
                      <Link
                        to="/martingale"
                        onClick={() => setMobileMenuOpen(false)}
                        className={`w-full px-4 py-2 rounded-lg text-left text-sm transition-colors block ${
                          activeView === 'martingale'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        Martingale Sim
                      </Link>
                    </div>
                  )}
                </div>
              </nav>

              {/* X/Twitter Link and Donate Button in Mobile Menu */}
              <div className="px-4 pb-4 border-t border-slate-700 pt-4 space-y-2">
                <a
                  href="https://x.com/oredotmonster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>Follow on X</span>
                </a>
                <button
                  onClick={handleCopyAddress}
                  className="w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 border border-pink-500/30"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  <span>{addressCopied ? 'Address Copied!' : 'Donate'}</span>
                </button>
              </div>

            </div>
          </div>
      </>
    </header>
  );
}

