import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { PriceSnapshot } from '../types/api';
import { SolanaLogo } from './SolanaLogo';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMenu } from './WalletMenu';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getWalletBalances } from '../services/api';
import { PublicKey } from '@solana/web3.js';

// Type declaration for window.solana
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      isSeeker?: boolean;
      isSolflare?: boolean;
      [key: string]: any;
    };
  }
}

type View = 'dashboard' | 'mines' | 'about' | 'treasury' | 'leaderboard' | 'strategies' | 'profile' | 'inflation' | 'token' | 'revenue' | 'martingale' | 'staking' | 'liquidity' | 'unrefined' | 'what-is-ore' | 'miners' | 'dust-to-ore' | 'explore' | 'monster-rewards';

// Custom wallet connect button that shows "Connect" when disconnected
function WalletConnectButtonCustom({ onWalletClick, onMobileWalletClick }: { onWalletClick?: () => void; onMobileWalletClick?: () => void }) {
  const { connecting, connected, publicKey } = useWallet();
  const { setVisible } = useWalletModal();

  // Check if user is in a Solana-compatible browser or has wallet extension
  const isSolanaBrowser = () => {
    // Check if any Solana wallet provider is available
    // This includes:
    // - Phantom browser (window.solana.isPhantom)
    // - Seeker mobile browser (window.solana.isSeeker)
    // - Phantom extension in Chrome/Firefox (window.solana)
    // - Other Solana wallet extensions
    return typeof window !== 'undefined' && (
      window.solana?.isPhantom ||
      window.solana?.isSeeker ||
      window.solana?.isSolflare ||
      window.solana?.isCoinbaseWallet ||
      window.solana?.isLedger ||
      // Check for any Solana wallet provider object
      (window.solana && typeof window.solana === 'object' && window.solana.isConnected !== undefined)
    );
  };

  const handleClick = () => {
    if (connected && publicKey) {
      // On mobile, if onMobileWalletClick is provided, open mobile menu instead
      if (onMobileWalletClick) {
        onMobileWalletClick();
      } else {
        // Trigger custom event to open wallet menu (desktop)
        window.dispatchEvent(new CustomEvent('openWalletMenu'));
        if (onWalletClick) onWalletClick();
      }
    } else {
      // Check if user is in a regular browser (not Solana-compatible)
      if (!isSolanaBrowser()) {
        alert('To connect your wallet, please open ore.monster in a Solana-compatible browser like Phantom or Seeker mobile.');
        return;
      }

      // If onWalletClick is provided and user is not connected, still call it
      // This allows mobile menu to handle the wallet modal opening
      if (onWalletClick) {
        onWalletClick();
        // Small delay to allow menu to close before opening wallet modal
        setTimeout(() => setVisible(true), 100);
      } else {
        setVisible(true);
      }
    }
  };
  
  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
    
    return (
      <button
        onClick={handleClick}
        className="bg-slate-800 border border-slate-500 text-white hover:bg-slate-700 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
      >
        {truncatedAddress}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={connecting}
      className="bg-white text-black hover:bg-gray-100 rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {connecting ? 'Connecting...' : 'Connect'}
    </button>
  );
}

interface HeaderProps {
  solPrice: PriceSnapshot | null;
  orePrice: PriceSnapshot | null;
  currentView?: View;
  walletMenuOpen?: boolean;
  setWalletMenuOpen?: (open: boolean) => void;
}

export function Header({ solPrice, orePrice, currentView = 'dashboard', walletMenuOpen: externalWalletMenuOpen, setWalletMenuOpen: setExternalWalletMenuOpen }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statsDropdownOpen, setStatsDropdownOpen] = useState(false);
  const [mobileStatsDropdownOpen, setMobileStatsDropdownOpen] = useState(false);
  const [stakingSubmenuOpen, setStakingSubmenuOpen] = useState(false);
  const [stakingSubmenuTimeout, setStakingSubmenuTimeout] = useState<number | null>(null);
  const [toolDropdownOpen, setToolDropdownOpen] = useState(false);
  const [walletSearch, setWalletSearch] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [mobileSearchBarOpen, setMobileSearchBarOpen] = useState(false);
  
  // Wallet data for mobile menu
  const [mobileSolBalance, setMobileSolBalance] = useState<number | null>(null);
  const [mobileOreBalances, setMobileOreBalances] = useState<{
    wallet: string;
    staked: string;
    refined: string;
    unrefined: string;
    total: string;
  } | null>(null);
  const [mobileWalletLoading, setMobileWalletLoading] = useState(true);

  // Determine current view from location if not provided
  const getCurrentView = (): View => {
    if (currentView) return currentView;
    const path = location.pathname;
    if (path === '/' || path === '/home') return 'mines';
    if (path === '/about') return 'about';
    if (path === '/treasury') return 'treasury';
    if (path === '/inflation') return 'inflation';
    if (path === '/token') return 'token';
    if (path === '/revenue') return 'revenue';
    if (path === '/leaderboard') return 'leaderboard';
    if (path === '/strategies') return 'strategies';
    if (path === '/my-profile') return 'profile';
    if (path === '/martingale') return 'martingale';
    if (path === '/staking') return 'staking';
    if (path === '/liquidity') return 'liquidity';
    if (path === '/unrefined') return 'unrefined';
    if (path === '/miners') return 'miners';
    if (path === '/what-is-ore') return 'what-is-ore';
    if (path === '/dust-to-ore') return 'dust-to-ore';
    if (path === '/explore') return 'explore';
    return 'dashboard';
  };

  const activeView = getCurrentView();

  // Manage wallet menu state - use external state if provided, otherwise use internal state
  const [internalWalletMenuOpen, setInternalWalletMenuOpen] = useState(false);
  const walletMenuOpen = externalWalletMenuOpen !== undefined ? externalWalletMenuOpen : internalWalletMenuOpen;
  const setWalletMenuOpen = setExternalWalletMenuOpen || setInternalWalletMenuOpen;

  useEffect(() => {
    const handleWalletClick = () => {
      setWalletMenuOpen(true);
    };
    
    window.addEventListener('openWalletMenu', handleWalletClick);
    return () => window.removeEventListener('openWalletMenu', handleWalletClick);
  }, [setWalletMenuOpen]);

  // Fetch wallet data for mobile menu when it opens and wallet is connected
  useEffect(() => {
    if (mobileMenuOpen && connected && publicKey) {
      setMobileWalletLoading(true);
      const address = publicKey.toBase58();
      
      // Fetch SOL balance
      connection.getBalance(publicKey)
        .then((balance) => {
          setMobileSolBalance(balance / LAMPORTS_PER_SOL);
          setMobileWalletLoading(false);
        })
        .catch(() => {
          setMobileSolBalance(null);
        });
      
      // Fetch ORE balances
      getWalletBalances(address)
        .then((oreData) => {
          setMobileOreBalances({
            wallet: oreData.wallet || '0',
            staked: oreData.staked || '0',
            refined: oreData.refined || '0',
            unrefined: oreData.unrefined || '0',
            total: oreData.total || '0',
          });
        })
        .catch(() => {
          setMobileOreBalances({
            wallet: '0',
            staked: '0',
            refined: '0',
            unrefined: '0',
            total: '0',
          });
        });
    } else if (!mobileMenuOpen) {
      // Reset when menu closes
      setMobileSolBalance(null);
      setMobileOreBalances(null);
    }
  }, [mobileMenuOpen, connected, publicKey, connection]);

  // Helper functions for mobile menu
  const formatOreBalance = (balance: string | null | undefined) => {
    if (!balance || balance === '0' || balance === '') return '0';
    const num = parseFloat(balance);
    if (isNaN(num)) return '0';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 });
  };

  const calculateTotalOre = () => {
    if (!mobileOreBalances) return '0';
    const unrefined = parseFloat(mobileOreBalances.unrefined) || 0;
    const refined = parseFloat(mobileOreBalances.refined) || 0;
    const staked = parseFloat(mobileOreBalances.staked) || 0;
    const unrefinedAfterFee = unrefined * 0.9;
    return (unrefinedAfterFee + refined + staked).toFixed(5);
  };

  const calculatePortfolioValue = () => {
    const solValue = (mobileSolBalance && solPrice) ? mobileSolBalance * parseFloat(solPrice.priceUsdRaw) : 0;
    const totalOreNum = parseFloat(calculateTotalOre()) || 0;
    const oreValue = orePrice ? totalOreNum * parseFloat(orePrice.priceUsdRaw) : 0;
    return solValue + oreValue;
  };

  // Handle wallet search
  const handleWalletSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    
    const trimmed = walletSearch.trim();
    if (!trimmed) return;
    
    try {
      // Validate wallet address
      const pubkey = new PublicKey(trimmed);
      // Navigate to profile page with wallet address
      navigate(`/my-profile?wallet=${pubkey.toBase58()}`);
      setWalletSearch('');
      setSearchBarOpen(false);
      setMobileSearchBarOpen(false);
    } catch (err) {
      setSearchError('Invalid wallet address');
      setTimeout(() => setSearchError(null), 3000);
    }
  };

  // Close search modal on Esc key and prevent body scroll
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchBarOpen) {
        setSearchBarOpen(false);
        setWalletSearch('');
        setSearchError(null);
      }
    };

    if (searchBarOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [searchBarOpen]);

  return (
    <header className="bg-black border-b border-slate-700 sticky top-0 z-50 min-h-[65px] flex items-center shrink-0">
      <div className="w-full px-4 py-3 flex items-center justify-between min-h-[65px]">
            {/* Logo and Navigation - left */}
            <div className="flex items-center gap-2 sm:gap-4 lg:gap-8 min-w-0 flex-shrink-0">
              <Link
                to="/"
                className="hover:opacity-80 transition-opacity flex-shrink-0"
              >
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-1.5 sm:px-2 py-1.5">
                  <img 
                    src="/oreguidelogo.png" 
                    alt="ORE Guide" 
                    className="h-8 sm:h-10 w-auto object-contain cursor-pointer flex-shrink-0"
                  />
                </div>
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-2">
                <Link
                  to="/"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeView === 'mines'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  Mines
                </Link>
                <Link
                  to="/explore"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'explore'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Explore
                </Link>
                <Link
                  to="/about"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'about'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  About
                </Link>
                <Link
                  to="/my-profile"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'profile'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Profile
                </Link>
                <Link
                  to="/leaderboard"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeView === 'leaderboard'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
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
                    ['treasury', 'inflation', 'token', 'revenue', 'strategies', 'staking', 'liquidity', 'unrefined', 'martingale', 'miners'].includes(activeView)
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  Analytics
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
              <div
                className="relative"
                onMouseEnter={() => setToolDropdownOpen(true)}
                onMouseLeave={() => setToolDropdownOpen(false)}
              >
                <button
                  onClick={() => setToolDropdownOpen(open => !open)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    activeView === 'dust-to-ore'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                    Tools
                  <svg
                    className={`w-4 h-4 ml-1 transition-transform ${toolDropdownOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {toolDropdownOpen && (
                  <div className="absolute top-full left-0 pt-1 w-44 z-50">
                    <div className="bg-black border-2 border-slate-600 rounded-lg shadow-xl">
                      <Link
                        to="/dust-to-ore"
                        onClick={() => setToolDropdownOpen(false)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors rounded-lg block ${
                          activeView === 'dust-to-ore'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        Dust to ORE
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </nav>
        </div>

        {/* Prices, Search, and Wallet - right */}
        <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 flex-shrink-0 ml-2 sm:ml-0">
          {/* Solana Price */}
          <a
            href="https://jup.ag/tokens/So11111111111111111111111111111111111111112"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
          >
            <SolanaLogo width={16} height={16} className="sm:w-6 sm:h-6" />
            <span className="text-slate-200 font-medium whitespace-nowrap text-xs sm:text-base">
              {solPrice ? `$${parseFloat(solPrice.priceUsdRaw).toFixed(2)}` : '...'}
            </span>
          </a>

          {/* ORE Price */}
          <a
            href="https://jup.ag/tokens/oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 sm:gap-2 hover:opacity-80 transition-opacity cursor-pointer flex-shrink-0"
          >
            <img 
              src="/orelogo.jpg" 
              alt="ORE" 
              className="w-3.5 h-3.5 sm:w-5 sm:h-5 object-contain rounded flex-shrink-0"
            />
            <span className="text-slate-200 font-medium whitespace-nowrap text-xs sm:text-base">
              {orePrice ? `$${parseFloat(orePrice.priceUsdRaw).toFixed(2)}` : '...'}
            </span>
          </a>

          {/* Wallet Search Button - Next to prices */}
          <div className="hidden md:flex items-center">
            <button
              onClick={() => {
                setSearchBarOpen(true);
                // Focus input after it renders
                setTimeout(() => {
                  const input = document.querySelector('.wallet-search-modal-input') as HTMLInputElement;
                  input?.focus();
                }, 0);
              }}
              className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
              aria-label="Open wallet search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>

          {/* Mobile Connect Button - Next to prices */}
          <div className="sm:hidden">
            <WalletConnectButtonCustom onMobileWalletClick={() => setMobileMenuOpen(true)} />
          </div>

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

          {/* Wallet connect (Phantom) - Desktop only */}
          <div className="hidden sm:block">
            <WalletConnectButtonCustom />
            {walletMenuOpen && <WalletMenu isOpen={walletMenuOpen} onClose={() => setWalletMenuOpen(false)} solPrice={solPrice} orePrice={orePrice} />}
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

              {/* Wallet Search Bar - Mobile */}
              <div className="px-4 pt-4 pb-4 border-b border-slate-700">
                {!mobileSearchBarOpen ? (
                  <button
                    onClick={() => {
                      setMobileSearchBarOpen(true);
                      // Focus input after it renders
                      setTimeout(() => {
                        const input = document.querySelector('.mobile-wallet-search-input') as HTMLInputElement;
                        input?.focus();
                      }, 0);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-400 hover:text-amber-400 hover:border-amber-500/50 transition-colors mb-4"
                    aria-label="Open wallet search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-sm">Search wallet address...</span>
                  </button>
                ) : (
                  <form onSubmit={handleWalletSearch} className="w-full relative mb-4">
                    <input
                      type="text"
                      value={walletSearch}
                      onChange={(e) => {
                        setWalletSearch(e.target.value);
                        setSearchError(null);
                      }}
                      placeholder="Search wallet address..."
                      className="mobile-wallet-search-input w-full bg-slate-800/50 border border-slate-600 rounded-lg px-4 py-2 pr-20 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                      autoFocus
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button
                        type="submit"
                        className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                        aria-label="Search wallet"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileSearchBarOpen(false);
                          setWalletSearch('');
                          setSearchError(null);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                        aria-label="Close search"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    {searchError && (
                      <div className="absolute top-full left-0 mt-1 bg-red-500/20 border border-red-500/50 rounded px-2 py-1 text-xs text-red-400 whitespace-nowrap z-50">
                        {searchError}
                      </div>
                    )}
                  </form>
                )}
              </div>

              {/* Wallet Section - Always show, with scaffolding when not connected */}
              <div className="px-4 pt-4 pb-4 border-b border-slate-700">
                {connected && publicKey ? (
                  <>
                    {/* Wallet Profile Section - Connected */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-white border-2 border-slate-400 flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => {
                              setMobileMenuOpen(false);
                              setWalletMenuOpen(true);
                            }}
                            className="text-left w-full"
                          >
                            <p className="text-sm font-medium text-slate-200 truncate">{publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}</p>
                            <p className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                              View Full Wallet
                            </p>
                          </button>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          disconnect();
                          setMobileMenuOpen(false);
                        }}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors ml-2 flex-shrink-0"
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Portfolio Value */}
                    {solPrice && orePrice && (
                      <div className="mb-3 p-3 bg-slate-800/50 border border-slate-600 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-400">Portfolio Value</span>
                          <span className="text-base font-semibold text-white">
                            ${mobileWalletLoading ? '...' : calculatePortfolioValue().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <SolanaLogo width={14} height={14} />
                            <span className="text-slate-500">SOL</span>
                          </div>
                          <span className="text-slate-300">
                            {mobileWalletLoading || mobileSolBalance === null ? '...' : mobileSolBalance.toFixed(4)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-1">
                          <div className="flex items-center gap-1.5">
                            <img src="/orelogo.jpg" alt="ORE" className="w-3.5 h-3.5 object-contain rounded" />
                            <span className="text-slate-500">ORE</span>
                          </div>
                          <span className="text-slate-300">
                            {mobileWalletLoading || !mobileOreBalances ? '...' : formatOreBalance(calculateTotalOre())}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Quick Balances */}
                    {mobileOreBalances && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-800/50 border border-slate-600 rounded p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" />
                            <p className="text-slate-500">Wallet ORE</p>
                          </div>
                          <p className="text-white font-medium">{formatOreBalance(mobileOreBalances.wallet)}</p>
                        </div>
                        <div className="bg-slate-800/50 border border-slate-600 rounded p-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" />
                            <p className="text-slate-500">Staked ORE</p>
                          </div>
                          <p className="text-white font-medium">{formatOreBalance(mobileOreBalances.staked)}</p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Connect Prompt - Centered */}
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-3">
                        Connect your wallet to view your portfolio and balances
                      </p>
                      <div className="flex justify-center">
                        <WalletConnectButtonCustom onWalletClick={() => {
                          // Mobile menu stays open, wallet modal opens
                        }} />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Menu Items */}
              <nav className="flex-1 overflow-y-auto p-4 space-y-2">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${
                    activeView === 'mines'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" />
                  Mines
                </Link>
                <Link
                  to="/about"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${
                    activeView === 'about'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  About
                </Link>
                <Link
                  to="/my-profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${
                    activeView === 'profile'
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
                      ['treasury', 'inflation', 'token', 'revenue', 'strategies', 'staking', 'liquidity', 'unrefined', 'martingale', 'miners'].includes(activeView)
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
                <Link
                  to="/dust-to-ore"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full px-4 py-3 rounded-lg text-left font-medium transition-colors flex items-center gap-3 ${
                    activeView === 'dust-to-ore'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Dust to ORE
                </Link>
              </nav>

              {/* X/Twitter Link in Mobile Menu */}
              <div className="px-4 pb-4 border-t border-slate-700 pt-4">
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
              </div>

            </div>
          </div>
      </>

      {/* Wallet Search Modal - Centered overlay */}
      {searchBarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 z-[60] backdrop-blur-sm"
            onClick={() => {
              setSearchBarOpen(false);
              setWalletSearch('');
              setSearchError(null);
            }}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
            <div 
              className="bg-[#1a1a1a] border-2 border-slate-600 rounded-2xl shadow-2xl w-full max-w-2xl pointer-events-auto animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleWalletSearch} className="p-6">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={walletSearch}
                    onChange={(e) => {
                      setWalletSearch(e.target.value);
                      setSearchError(null);
                    }}
                    placeholder="Search wallet address or profile..."
                    className="wallet-search-modal-input w-full bg-slate-800/50 border-2 border-slate-600 rounded-xl px-14 py-4 text-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchBarOpen(false);
                      setWalletSearch('');
                      setSearchError(null);
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-colors"
                    aria-label="Close search"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {searchError && (
                  <div className="mt-3 bg-red-500/20 border border-red-500/50 rounded-lg px-4 py-2 text-sm text-red-400">
                    {searchError}
                  </div>
                )}
                
                {/* Search Hints */}
                <div className="mt-6 pt-6 border-t border-slate-700">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Search for:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                      <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Wallet Address</p>
                        <p className="text-xs text-slate-400 mt-0.5">View profile by Solana wallet address</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                      <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-slate-200">Miner Profile</p>
                        <p className="text-xs text-slate-400 mt-0.5">See mining stats and leaderboard rank</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4 text-center">
                    Press <kbd className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-300">Enter</kbd> to search or <kbd className="px-2 py-1 bg-slate-800 border border-slate-600 rounded text-slate-300">Esc</kbd> to close
                  </p>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Wallet Menu - Works on both desktop and mobile */}
      {walletMenuOpen && (
        <WalletMenu 
          isOpen={walletMenuOpen} 
          onClose={() => {
            setWalletMenuOpen(false);
            // Also close mobile menu if it was open
            if (mobileMenuOpen) {
              setMobileMenuOpen(false);
            }
          }} 
          solPrice={solPrice} 
          orePrice={orePrice} 
        />
      )}
    </header>
  );
}