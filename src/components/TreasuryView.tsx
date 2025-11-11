import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { getTreasuries, getWalletBalance, getSupplyOnMarket, getInflationCurrent, get24hMinted, getNetEmissions, getTokenCurrent, getTokenHistory, getTokenDistribution, getRevenueHistory, getSolMarketCap } from '../services/api';
import { SolanaLogo } from './SolanaLogo';

const TREASURY_WALLET = '45db2FSR4mcXdSVVZbKbwojU6uYDpMyhpEi7cC8nHaWG';
const LAMPORTS_PER_SOL = 1e9;
const ORE_CONVERSION_FACTOR = 1e11; // ORE values use 1e11 conversion factor

interface TreasuryDataPoint {
  id: number;
  balance: number;
  motherlode: number;
  total_staked: number;
  total_unclaimed: number;
  total_refined: number;
  created_at: string;
}

interface ChartDataPoint {
  time: Date;
  balance: number;
  totalUnclaimed: number;
  totalRefined: number;
  totalStaked: number;
  timeAgo: string;
}


interface TreasuryViewProps {
  currentView?: string;
}

export function TreasuryView({ currentView = 'treasury' }: TreasuryViewProps) {
  const [treasuryData, setTreasuryData] = useState<TreasuryDataPoint[]>([]);
  const [supplyOnMarket, setSupplyOnMarket] = useState<any>(null);
  const [inflationCurrent, setInflationCurrent] = useState<any>(null);
  const [minted24h, setMinted24h] = useState<any>(null);
  const [netEmissions, setNetEmissions] = useState<any[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(true);
  const [inflationLoading, setInflationLoading] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenCurrent, setTokenCurrent] = useState<any>(null);
  const [tokenHistory, setTokenHistory] = useState<any[]>([]);
  const [tokenDistribution, setTokenDistribution] = useState<any[]>([]);
  const [tokenTimeframe, setTokenTimeframe] = useState<number>(168); // 7 days default
  const [revenueLoading, setRevenueLoading] = useState(true);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [solMarketCap, setSolMarketCap] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, setBalanceLoading] = useState(true);

  // Reset loading states when view changes - simplified approach
  // Don't interfere with data fetching, just ensure views can render
  useEffect(() => {
    // Clear error when switching views
    if (currentView) {
      // Don't clear data - let views use cached data if available
      // This prevents black screen by showing cached data immediately
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== 'treasury') {
      return;
    }

    const fetchTreasuryData = async () => {
      try {
        setTreasuryLoading(true);
        setError(null);
        const data = await getTreasuries();
        // Only update if data has actually changed
        setTreasuryData(prevData => {
          // If no previous data, always update
          if (prevData.length === 0) {
            return data;
          }
          
          // Check if data is different by comparing IDs, length, or balances
          if (prevData.length !== data.length) {
            return data;
          }
          
          // Create a stable comparison by sorting both arrays by ID
          const prevSorted = [...prevData].sort((a, b) => a.id - b.id);
          const currSorted = [...data].sort((a, b) => a.id - b.id);
          
          // Check if any entry has changed
          const hasChanges = prevSorted.some((prev, index) => {
            const curr = currSorted[index];
            if (!curr) return true;
            // Compare key fields that matter for the chart
            return prev.id !== curr.id || 
                   prev.balance !== curr.balance || 
                   prev.created_at !== curr.created_at;
          });
          
          return hasChanges ? data : prevData;
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch treasury data';
        setError(errorMessage);
        console.error('Error fetching treasury data:', err);
      } finally {
        setTreasuryLoading(false);
      }
    };

    fetchTreasuryData();
    // Refresh treasury data every 60 seconds
    const interval = setInterval(fetchTreasuryData, 60000);
    return () => clearInterval(interval);
  }, [currentView]);


  useEffect(() => {
    if (currentView !== 'inflation') {
      setInflationLoading(false);
      // Don't clear data to prevent flash of empty state when switching away
      return;
    }

    const fetchInflationData = async () => {
      try {
        setInflationLoading(true);
        setError(null);
        const [supply, current, minted, emissions] = await Promise.all([
          getSupplyOnMarket(),
          getInflationCurrent(),
          get24hMinted(),
          getNetEmissions(30).catch(() => []) // Fetch 30 days, fallback to empty array if fails
        ]);
        setSupplyOnMarket(supply);
        setInflationCurrent(current);
        setMinted24h(minted);
        setNetEmissions(emissions);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch inflation data';
        setError(errorMessage);
        console.error('Error fetching inflation data:', err);
      } finally {
        setInflationLoading(false);
      }
    };

    fetchInflationData();
    // Refresh inflation data every 60 seconds
    const interval = setInterval(fetchInflationData, 60000);
    return () => clearInterval(interval);
  }, [currentView]);

  useEffect(() => {
    const fetchCurrentBalance = async () => {
      try {
        setBalanceLoading(true);
        const balance = await getWalletBalance(TREASURY_WALLET);
        // Only update if balance has actually changed
        setCurrentBalance(prevBalance => {
          if (prevBalance === null || Math.abs(prevBalance - balance) > 0.0001) {
            return balance;
          }
          return prevBalance;
        });
      } catch (err) {
        // Silently handle wallet balance errors - they're not critical
        // The error is likely due to CORS restrictions on the Solana RPC endpoint
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchCurrentBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchCurrentBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  // Process data for chart - memoized with stable time calculation
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!treasuryData.length) return [];

    // Sort by created_at ascending for proper time series
    const sorted = [...treasuryData].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const now = new Date();
    // Calculate timeAgo once and cache it - only update when data changes
    return sorted.map((snapshot) => {
      const createdAt = new Date(snapshot.created_at);
      const timeDiff = now.getTime() - createdAt.getTime();
      const hoursAgo = timeDiff / (1000 * 60 * 60);
      const minutesAgo = timeDiff / (1000 * 60);

      let timeAgo: string;
      if (hoursAgo >= 1) {
        const hours = Math.floor(hoursAgo);
        const minutes = Math.floor((hoursAgo - hours) * 60);
        if (minutes > 0) {
          timeAgo = `${hours}h ${minutes}m ago`;
        } else {
          timeAgo = `${hours}h ago`;
        }
      } else if (minutesAgo >= 1) {
        timeAgo = `${Math.floor(minutesAgo)}m ago`;
      } else {
        timeAgo = 'Now';
      }

      return {
        time: createdAt,
        balance: snapshot.balance / LAMPORTS_PER_SOL,
        totalUnclaimed: snapshot.total_unclaimed / ORE_CONVERSION_FACTOR,
        totalRefined: snapshot.total_refined / ORE_CONVERSION_FACTOR,
        totalStaked: snapshot.total_staked / ORE_CONVERSION_FACTOR,
        timeAgo,
      };
    });
  }, [treasuryData]);

  // Calculate supply statistics from latest treasury data
  const supplyStats = useMemo(() => {
    if (!treasuryData.length) return null;

    const latest = treasuryData[treasuryData.length - 1];
    
    // Calculate totals in ORE
    const totalStaked = latest.total_staked / ORE_CONVERSION_FACTOR;
    const totalUnclaimed = latest.total_unclaimed / ORE_CONVERSION_FACTOR;
    const totalRefined = latest.total_refined / ORE_CONVERSION_FACTOR;
    
    // Total Supply = Staked + Unclaimed + Refined
    const totalSupply = totalStaked + totalUnclaimed + totalRefined;
    
    // Supply on Market = Unclaimed + Refined (available for sale)
    const supplyOnMarket = totalUnclaimed + totalRefined;
    
    return {
      totalSupply,
      supplyOnMarket,
      totalStaked,
      totalUnclaimed,
      totalRefined,
    };
  }, [treasuryData]);

  // Calculate 24h flow statistics
  const flowStats = useMemo(() => {
    if (!treasuryData.length || treasuryData.length < 2) return null;

    // Sort by date to ensure we have the right order
    const sorted = [...treasuryData].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    const latest = sorted[sorted.length - 1];
    const latestTime = new Date(latest.created_at).getTime();
    
    // Find data from approximately 24 hours ago (must be before latest time)
    const twentyFourHoursAgo = latestTime - (24 * 60 * 60 * 1000);
    
    // Find the entry that is closest to but before 24 hours ago
    let dayAgoData: TreasuryDataPoint | null = null;
    let minDiff = Infinity;
    
    for (const entry of sorted) {
      const entryTime = new Date(entry.created_at).getTime();
      // Only consider entries that are before 24h ago (or very close, within 1 hour before)
      if (entryTime <= twentyFourHoursAgo + (60 * 60 * 1000)) {
        const diff = Math.abs(entryTime - twentyFourHoursAgo);
        if (diff < minDiff) {
          minDiff = diff;
          dayAgoData = entry;
        }
      }
    }
    
    // If we couldn't find data from 24h ago, use the oldest available data
    if (!dayAgoData && sorted.length > 1) {
      dayAgoData = sorted[0];
    }
    
    if (!dayAgoData || dayAgoData.id === latest.id) return null;
    
    // Calculate 24h changes
    const unclaimedChange = (latest.total_unclaimed - dayAgoData.total_unclaimed) / ORE_CONVERSION_FACTOR;
    // refinedChange and stakedChange calculated but not used in current implementation
    const _refinedChange = (latest.total_refined - dayAgoData.total_refined) / ORE_CONVERSION_FACTOR;
    const _stakedChange = (latest.total_staked - dayAgoData.total_staked) / ORE_CONVERSION_FACTOR;
    void _refinedChange;
    void _stakedChange;
    
    // Withdrawn = increase in unclaimed (ORE that was claimed and moved to market)
    // This represents ORE that miners claimed and can now sell
    const withdrawn = Math.max(0, unclaimedChange);
    
    // Buyback = decrease in total supply or increase in refined (fees collected)
    // Buyback removes ORE from circulation, which would decrease total supply
    // However, we can also calculate it from the decrease in unclaimed (when it goes down, that's buyback)
    // Or from the increase in refined (fees)
    const totalSupplyLatest = (latest.total_staked + latest.total_unclaimed + latest.total_refined) / ORE_CONVERSION_FACTOR;
    const totalSupplyDayAgo = (dayAgoData.total_staked + dayAgoData.total_unclaimed + dayAgoData.total_refined) / ORE_CONVERSION_FACTOR;
    const totalSupplyChange = totalSupplyLatest - totalSupplyDayAgo;
    
    // Buyback is when total supply decreases (ORE is removed from circulation)
    // This could happen through treasury operations
    const buyback = Math.max(0, -totalSupplyChange);
    
    // Alternative: if unclaimed decreases, that could also be buyback
    // But for now, we'll use the total supply decrease method
    // If that gives 0, we might want to use a different calculation
    
    // Net Market Inflation = Withdrawn - Buyback
    // Positive = inflation (more ORE entering market)
    // Negative = deflation (more ORE being removed)
    const netMarketInflation = withdrawn - buyback;
    
    return {
      withdrawn,
      buyback,
      netMarketInflation,
    };
  }, [treasuryData]);

  // Formatting functions (defined once at top level)
  const formatSol = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatOre = (value: number | string) => {
    // Format ORE values with K suffix when >= 1000, with 2 decimal places
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1000) {
      const kValue = num / 1000;
      return kValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + 'K';
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatOreSmall = (value: number) => {
    // Format ORE values without K suffix, always show 2 decimal places
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatOreAxis = (value: number) => {
    // Format for Y-axis: show K suffix when >= 1000
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  // Calculate USD value if we have SOL price (we'll need to get it from state or props)
  // For now, we'll just show SOL
  const latestBalance = chartData.length > 0 ? chartData[chartData.length - 1].balance : 0;
  const displayBalance = currentBalance !== null ? currentBalance : latestBalance;

  // Calculate chart data for net emissions - ALWAYS call this hook (unconditionally)
  const netEmissionsChartData = useMemo(() => {
    if (netEmissions.length === 0) return [];
    const sorted = [...netEmissions].sort((a, b) => a.roundId - b.roundId);
    return sorted.map((item, index) => {
      // Calculate 20-round MA
      const start20 = Math.max(0, index - 19);
      const slice20 = sorted.slice(start20, index + 1);
      const ma20 = slice20.length > 0 
        ? slice20.reduce((sum, d) => sum + d.netEmission, 0) / slice20.length 
        : item.netEmission;
      
      // Calculate 100-round MA
      const start100 = Math.max(0, index - 99);
      const slice100 = sorted.slice(start100, index + 1);
      const ma100 = slice100.length > 0 
        ? slice100.reduce((sum, d) => sum + d.netEmission, 0) / slice100.length 
        : item.netEmission;
      
      return {
        roundId: item.roundId,
        roundLabel: `R${item.roundId}`,
        netEmission: item.netEmission,
        ma20: ma20,
        ma100: ma100
      };
    });
  }, [netEmissions]);

  // Calculate round breakdown data - ALWAYS call this hook (unconditionally)
  const roundBreakdownData = useMemo(() => {
    const allTime = {
      deflationary: netEmissions.filter(r => r.netEmission < 0).length,
      inflationary: netEmissions.filter(r => r.netEmission >= 0).length,
      total: netEmissions.length
    };
    
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const oneDay = netEmissions.filter(r => new Date(r.completedAt).getTime() > oneDayAgo);
    const oneDayData = {
      deflationary: oneDay.filter(r => r.netEmission < 0).length,
      inflationary: oneDay.filter(r => r.netEmission >= 0).length,
      total: oneDay.length
    };
    
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const sevenDay = netEmissions.filter(r => new Date(r.completedAt).getTime() > sevenDaysAgo);
    const sevenDayData = {
      deflationary: sevenDay.filter(r => r.netEmission < 0).length,
      inflationary: sevenDay.filter(r => r.netEmission >= 0).length,
      total: sevenDay.length
    };
    
    const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const oneMonth = netEmissions.filter(r => new Date(r.completedAt).getTime() > oneMonthAgo);
    const oneMonthData = {
      deflationary: oneMonth.filter(r => r.netEmission < 0).length,
      inflationary: oneMonth.filter(r => r.netEmission >= 0).length,
      total: oneMonth.length
    };
    
    return { allTime, oneDay: oneDayData, sevenDay: sevenDayData, oneMonth: oneMonthData };
  }, [netEmissions]);

  // Token chart data - ALWAYS call this hook (unconditionally)
  const tokenChartData = useMemo(() => {
    if (!tokenHistory || !Array.isArray(tokenHistory) || tokenHistory.length === 0) return [];
    // Sort by timestamp ascending (oldest first) to show correct trend
    const sortedHistory = [...tokenHistory].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeA - timeB;
    });
    return sortedHistory.map((item) => ({
      date: new Date(item.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
      priceUsd: item.priceUsd || 0,
      priceSol: item.priceSol || 0,
      holders: item.holders || 0,
    }));
  }, [tokenHistory]);

  // Revenue calculations - ALWAYS call this hook (unconditionally)
  const revenueCalculations = useMemo(() => {
    if (!revenueData || !Array.isArray(revenueData) || revenueData.length === 0) return null;

    // Sort by date ascending (oldest first) for cumulative calculations
    const sortedData = [...revenueData].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    // Calculate totals since Oct 28
    const totalProtocolRevenueSol = sortedData.reduce((sum, day) => sum + day.protocolRevenueSol, 0);
    const totalProtocolRevenueUsd = sortedData.reduce((sum, day) => sum + day.protocolRevenueUsd, 0);
    const totalAdminFeeSol = sortedData.reduce((sum, day) => sum + day.adminFeeSol, 0);
    const totalAdminFeeUsd = sortedData.reduce((sum, day) => sum + day.adminFeeUsd, 0);
    const totalRounds = sortedData.reduce((sum, day) => sum + day.roundCount, 0);
    const combinedRevenueSol = totalProtocolRevenueSol + totalAdminFeeSol;
    const combinedRevenueUsd = totalProtocolRevenueUsd + totalAdminFeeUsd;

    // Find today's data (most recent day in the data)
    const todayData = sortedData.length > 0 ? sortedData[sortedData.length - 1] : null;
    const todayProtocolRevenueSol = todayData ? todayData.protocolRevenueSol : 0;
    const todayProtocolRevenueUsd = todayData ? todayData.protocolRevenueUsd : 0;

    // Create daily breakdown (sorted by date descending for table - newest first)
    const dailyBreakdown = [...sortedData]
      .reverse()
      .map(day => ({
        date: day.date,
        rounds: day.roundCount,
        protocolRevenueSol: day.protocolRevenueSol,
        protocolRevenueUsd: day.protocolRevenueUsd,
        adminFeeSol: day.adminFeeSol,
        adminFeeUsd: day.adminFeeUsd,
      }));

    // Create time series data for charts (daily values, sorted by date ascending)
    // Charts show daily revenue trends, while summary cards show cumulative totals
    const timeSeriesData = sortedData.map(day => ({
      date: new Date(day.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }),
      protocolRevenueSol: day.protocolRevenueSol,
      protocolRevenueUsd: day.protocolRevenueUsd,
      adminFeeSol: day.adminFeeSol,
      adminFeeUsd: day.adminFeeUsd,
    }));

    return {
      totalProtocolRevenueSol,
      totalProtocolRevenueUsd,
      totalAdminFeeSol,
      totalAdminFeeUsd,
      combinedRevenueSol,
      combinedRevenueUsd,
      totalRounds,
      dailyBreakdown,
      timeSeriesData,
      todayProtocolRevenueSol,
      todayProtocolRevenueUsd,
    };
  }, [revenueData]);

  // Fetch token data
  useEffect(() => {
    if (currentView !== 'token') {
      setTokenLoading(false);
      // Don't clear data to prevent flash of empty state when switching away
      return;
    }

    const fetchTokenData = async () => {
      try {
        setTokenLoading(true);
        setError(null);
        
        // Fetch all data separately to handle partial failures
        let current = null;
        let history: any[] = [];
        let distribution: any[] = [];
        
        try {
          current = await getTokenCurrent();
          console.log('Token current data:', current);
        } catch (err) {
          console.error('Error fetching token current:', err);
          setError(`Failed to fetch current token data: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        
        try {
          history = await getTokenHistory(tokenTimeframe);
          console.log('Token history data:', history);
          if (!Array.isArray(history)) {
            history = [];
          }
        } catch (err) {
          console.error('Error fetching token history:', err);
          // Don't set error for history/distribution failures, just log them
        }
        
        try {
          distribution = await getTokenDistribution();
          console.log('Token distribution data:', distribution);
          if (!Array.isArray(distribution)) {
            distribution = [];
          }
        } catch (err) {
          console.error('Error fetching token distribution:', err);
          // Don't set error for history/distribution failures, just log them
        }
        
        setTokenCurrent(current);
        setTokenHistory(history);
        setTokenDistribution(distribution);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch token data';
        setError(errorMessage);
        console.error('Error fetching token data:', err);
      } finally {
        setTokenLoading(false);
      }
    };

    fetchTokenData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchTokenData, 60000);
    return () => clearInterval(interval);
  }, [currentView, tokenTimeframe]);

  // Fetch revenue data
  useEffect(() => {
    if (currentView !== 'revenue') {
      setRevenueLoading(false);
      // Don't clear data to prevent flash of empty state when switching away
      return;
    }

    const fetchRevenueData = async () => {
      try {
        setRevenueLoading(true);
        setError(null);
        const data = await getRevenueHistory();
        setRevenueData(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch revenue data';
        setError(errorMessage);
        console.error('Error fetching revenue data:', err);
      } finally {
        setRevenueLoading(false);
      }
    };

    fetchRevenueData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchRevenueData, 60000);
    return () => clearInterval(interval);
  }, [currentView]);

  // Fetch SOL market cap for dominance calculation
  useEffect(() => {
    if (currentView !== 'token') {
      setSolMarketCap(null);
      return;
    }

    const fetchMarketCap = async () => {
      try {
        const marketCap = await getSolMarketCap();
        setSolMarketCap(marketCap);
      } catch (err) {
        console.error('Error fetching SOL market cap:', err);
        // Set a default value if API fails (approximate SOL market cap)
        setSolMarketCap(100e9); // ~100 billion USD as fallback
      }
    };

    fetchMarketCap();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketCap, 300000);
    return () => clearInterval(interval);
  }, [currentView]);

  // Token View formatting functions (defined outside conditional to avoid re-creation)
  const formatTokenOre = (value: number | string) => {
    if (!value && value !== 0) return '0';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    if (num >= 1000) {
      const kValue = num / 1000;
      return kValue.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + 'K';
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatTokenCurrency = (value: number) => {
    if (!value && value !== 0) return '$0';
    if (isNaN(value)) return '$0';
    if (value >= 1000000) {
      return '$' + (value / 1000000).toFixed(2) + 'M';
    }
    if (value >= 1000) {
      return '$' + (value / 1000).toFixed(2) + 'K';
    }
    return '$' + value.toFixed(4);
  };

  const formatTokenNumber = (value: number) => {
    if (!value && value !== 0) return '0';
    if (isNaN(value)) return '0';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const timeframeOptions = [
    { label: '1D', hours: 24 },
    { label: '7D', hours: 168 },
    { label: '14D', hours: 336 },
    { label: '30D', hours: 720 },
    { label: '3M', hours: 2160 },
    { label: '6M', hours: 4320 },
    { label: '12M', hours: 8640 },
    { label: '2Y', hours: 17520 },
  ];

  const distributionColors = [
    '#60a5fa', // light blue
    '#3b82f6', // blue
    '#2563eb', // darker blue
    '#f472b6', // light magenta
    '#ec4899', // magenta
    '#db2777', // darker magenta
    '#a855f7', // purple
    '#9333ea', // darker purple
    '#7e22ce', // very dark purple
  ];

  // Revenue formatting functions (defined once at top level)
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return '$' + (value / 1000000).toFixed(2) + 'M';
    }
    if (value >= 1000) {
      return '$' + (value / 1000).toFixed(2) + 'K';
    }
    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Chart formatters (defined once at top level)
  const formatChartCurrency = (value: number) => {
    return '$' + value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatChartSol = (value: number) => {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  // Token View - Render conditionally but all hooks are called above
  if (currentView === 'token') {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-100 mb-1">ORE Token Metrics</h1>
            <p className="text-slate-400 text-sm">
              Real-time token supply, price, market cap, and holder distribution tracking. (
              <a
                href="https://refinore.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-400 transition-colors"
              >
                charts by
                <img 
                  src="/refinore-logo.png" 
                  alt="refinORE" 
                  className="h-5 w-auto object-contain inline"
                  style={{ maxWidth: '80px' }}
                />
                refinORE.com
              </a>
              )
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400 font-semibold">Error loading data</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}

          {tokenLoading && !tokenCurrent ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading token data...</p>
              </div>
            </div>
          ) : tokenCurrent ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Supply */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" />
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Total Supply</h3>
                  <p className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                    <span>{formatTokenOre(tokenCurrent.totalSupply ? parseFloat(String(tokenCurrent.totalSupply)) : 0)}</span>
                  </p>
                  <p className="text-slate-500 text-sm">Total ORE tokens in circulation</p>
                </div>

                {/* Price */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Price</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatTokenCurrency(tokenCurrent.priceUsd || 0)}</p>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    ≈ {(tokenCurrent.priceSol || 0).toFixed(6)} <SolanaLogo width={14} height={14} className="inline" />
                  </p>
                </div>

                {/* Market Cap */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Market Cap</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatTokenCurrency(tokenCurrent.marketCap ? parseFloat(String(tokenCurrent.marketCap)) : 0)}</p>
                  <p className="text-slate-500 text-sm">Total market value</p>
                </div>

                {/* Holders */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Holders</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatTokenNumber(tokenCurrent.holders || 0)}</p>
                  <p className="text-slate-500 text-sm">Unique wallet addresses</p>
                </div>
              </div>

              {/* ORE Dominance Chart */}
              {tokenCurrent && solMarketCap && tokenHistory.length > 0 && (() => {
                // Sort by timestamp ascending (oldest first) so newest is on the right
                const sortedHistory = [...tokenHistory].sort((a, b) => {
                  const timeA = new Date(a.timestamp).getTime();
                  const timeB = new Date(b.timestamp).getTime();
                  return timeA - timeB;
                });
                
                // Calculate dominance for each historical point (ORE market cap / SOL market cap)
                const dominanceData = sortedHistory.map((item: any) => {
                  const oreMarketCap = parseFloat(item.priceUsd) * parseFloat(tokenCurrent.totalSupply);
                  const dominance = solMarketCap > 0 ? (oreMarketCap / solMarketCap) * 100 : 0;
                  return {
                    timestamp: item.timestamp,
                    date: new Date(item.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                    dominance: dominance,
                    marketCap: oreMarketCap,
                  };
                });

                // Calculate current dominance
                const currentOreMarketCap = parseFloat(tokenCurrent.priceUsd || 0) * parseFloat(tokenCurrent.totalSupply || 0);
                const currentDominance = solMarketCap > 0 ? (currentOreMarketCap / solMarketCap) * 100 : 0;

                // Find min and max for better axis scaling
                const dominanceValues = dominanceData.map(d => d.dominance);
                const minDominance = Math.min(...dominanceValues);
                const maxDominance = Math.max(...dominanceValues);
                const range = maxDominance - minDominance;
                const padding = range * 0.1; // 10% padding

                return (
                  <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 mb-6">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                        <span className="text-xl font-semibold text-slate-100">Dominance</span>
                        <span className="text-xl font-semibold text-slate-100">vs</span>
                        <SolanaLogo width={24} height={24} className="text-slate-100" />
                      </div>
                      <p className="text-slate-400 text-sm">
                        ORE market cap dominance against SOL market cap (ratio of ORE market cap to SOL market cap). This shows ORE's relative size within the Solana ecosystem.
                      </p>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center gap-2">
                        <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" />
                        <div>
                          <p className="text-3xl font-bold text-white">
                            {currentDominance.toFixed(6)}%
                          </p>
                          <p className="text-slate-400 text-xs">Current Dominance</p>
                        </div>
                      </div>
                    </div>
                    {dominanceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart key="dominance-chart" data={dominanceData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                          <XAxis 
                            dataKey="date" 
                            stroke="#94a3b8"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            interval="preserveStartEnd"
                          />
                          <YAxis 
                            stroke="#94a3b8"
                            tick={{ fill: '#94a3b8', fontSize: 11 }}
                            label={{ value: 'ORE Dominance vs SOL (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                            domain={[Math.max(0, minDominance - padding), maxDominance + padding]}
                            tickFormatter={(value) => {
                              if (value >= 0.01) return `${value.toFixed(2)}%`;
                              if (value >= 0.0001) return `${value.toFixed(4)}%`;
                              return `${value.toExponential(2)}%`;
                            }}
                            width={80}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px',
                              color: '#f1f5f9',
                            }}
                            formatter={(value: number) => [`${value.toFixed(6)}%`, 'ORE Dominance vs SOL']}
                            labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                          />
                          <Legend 
                            iconType="line"
                            formatter={() => 'ORE Dominance vs SOL (%)'}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="dominance" 
                            stroke="#f59e0b" 
                            strokeWidth={3} 
                            dot={{ r: 2, fill: '#f59e0b' }}
                            activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                            name="ORE Dominance vs SOL (%)" 
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-96 flex items-center justify-center text-slate-400">
                        No dominance data available
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Price & Holder Trend Chart */}
              <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-100 mb-1">Price & Holder Trend - USD ({timeframeOptions.find(o => o.hours === tokenTimeframe)?.label || '7D'})</h2>
                    <p className="text-slate-400 text-sm">Historical price in USD and holder count</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {timeframeOptions.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => setTokenTimeframe(option.hours)}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                          tokenTimeframe === option.hours
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {tokenChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart key="price-holder-chart" data={tokenChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'Price (USD)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'Holder Count', angle: 90, position: 'insideRight', fill: '#94a3b8', style: { fontSize: '12px' } }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="priceUsd" stroke="#3b82f6" strokeWidth={2} dot={false} name="Price (USD)" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="holders" stroke="#ec4899" strokeWidth={2} dot={false} name="Holder Count" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-96 flex items-center justify-center text-slate-400">
                    No chart data available
                  </div>
                )}
              </div>

              {/* Holder Distribution and Details */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Holder Distribution Donut Chart */}
                <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold text-slate-100 mb-1">Holder Distribution</h2>
                  <p className="text-slate-400 text-sm mb-4">Breakdown of holders by ORE amount</p>
                  {tokenDistribution.length > 0 ? (() => {
                    // Calculate total holders for percentage calculation
                    const totalHolders = tokenDistribution.reduce((sum, item) => sum + item.holders, 0);
                    
                    // Map and sort by percentage (largest first) for better visualization
                    const chartData = tokenDistribution
                      .map((item, idx) => {
                        const percent = totalHolders > 0 ? (item.holders / totalHolders) * 100 : 0;
                        return {
                          name: item.range,
                          value: item.holders,
                          percent: percent,
                          color: distributionColors[idx % distributionColors.length],
                        };
                      })
                      .sort((a, b) => b.value - a.value); // Sort by value descending
                    
                    // Custom label function - only show labels for segments >= 1%
                    const renderLabel = (entry: any) => {
                      if (entry.percent >= 1) {
                        return `${entry.percent.toFixed(0)}%`;
                      }
                      return '';
                    };
                    
                    return (
                      <ResponsiveContainer width="100%" height={400}>
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="45%"
                            labelLine={false}
                            label={renderLabel}
                            outerRadius={120}
                            innerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                            isAnimationActive={false}
                          >
                            {chartData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number, _name: string, props: any) => {
                              return [
                                `${value.toLocaleString()} holders (${props.payload.percent.toFixed(1)}%)`,
                                props.payload.name
                              ];
                            }}
                            contentStyle={{
                              backgroundColor: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '8px',
                              color: '#f1f5f9',
                            }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36}
                            formatter={(value, _entry: any) => {
                              const dataItem = chartData.find(d => d.name === value);
                              return dataItem ? `${value} (${dataItem.percent.toFixed(1)}%)` : value;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })() : (
                    <div className="h-96 flex items-center justify-center text-slate-400">
                      No distribution data available
                    </div>
                  )}
                </div>

                {/* Distribution Details Table */}
                <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
                  <h2 className="text-xl font-semibold text-slate-100 mb-1">Distribution Details</h2>
                  <p className="text-slate-400 text-sm mb-4">Holder counts and token amounts by range</p>
                  {tokenDistribution.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 text-sm font-semibold text-slate-400">Range (ORE)</th>
                            <th className="text-right py-2 text-sm font-semibold text-slate-400">Holders</th>
                            <th className="text-right py-2 text-sm font-semibold text-slate-400">Total ORE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tokenDistribution.map((item, idx) => (
                            <tr key={idx} className="border-b border-slate-700/50">
                              <td className="py-2 text-sm text-slate-200">{item.range}</td>
                              <td className="py-2 text-sm text-slate-200 text-right">{formatTokenNumber(item.holders)}</td>
                              <td className="py-2 text-sm text-slate-200 text-right">
                                <span className="inline-flex items-center gap-1 justify-end">
                                  <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" />
                                  <span>{formatTokenOre(parseFloat(item.totalOre))}</span>
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="h-96 flex items-center justify-center text-slate-400">
                      No distribution data available
                    </div>
                  )}
                </div>
              </div>

              {/* Chart Data Credit - refinORE.com */}
              <div className="w-full flex items-center justify-center pt-4 mb-2 -mx-4 px-4">
                <a
                  href="https://refinore.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <span>Chart breakdowns by</span>
                  <img 
                    src="/refinore-logo.png" 
                    alt="refinORE" 
                    className="h-5 w-auto object-contain"
                    style={{ maxWidth: '80px' }}
                  />
                  <span className="text-slate-400">refinORE.com</span>
                </a>
              </div>

              {/* Powered By - Full width */}
              <div className="w-full flex items-center justify-center pt-6 mt-6 border-t border-slate-700 -mx-4 px-4">
                <a
                  href="https://github.com/Kriptikz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <span>Powered by</span>
                  <img 
                    src="/kriptikz-logo.jpg" 
                    alt="Kriptikz" 
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-slate-400">Kriptikz</span>
                </a>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-slate-400">No token data available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Revenue View - Render conditionally but all hooks are called above
  if (currentView === 'revenue') {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-100 mb-1">Protocol Revenue</h1>
            <p className="text-slate-400 text-sm">
              Protocol revenue is defined as 10% of mining rewards and 1% of deployed SOL admin fees, since October 28th, 2025. (
              <a
                href="https://refinore.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-400 transition-colors"
              >
                charts by
                <img 
                  src="/refinore-logo.png" 
                  alt="refinORE" 
                  className="h-5 w-auto object-contain inline"
                  style={{ maxWidth: '80px' }}
                />
                refinORE.com
              </a>
              )
            </p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400 mb-4">
              Error: {error}
            </div>
          )}

          {revenueLoading && !revenueCalculations ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading revenue data...</p>
              </div>
            </div>
          ) : revenueCalculations ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                {/* Protocol Revenue (Since Oct 28) */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 pr-8">Protocol Revenue (Since Oct 28)</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatCurrency(revenueCalculations.totalProtocolRevenueUsd)}</p>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    {formatSol(revenueCalculations.totalProtocolRevenueSol)}
                    <SolanaLogo width={14} height={14} className="inline" />
                  </p>
                </div>

                {/* Protocol Revenue (Today) */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 pr-8">Protocol Revenue (Today)</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatCurrency(revenueCalculations.todayProtocolRevenueUsd)}</p>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    {formatSol(revenueCalculations.todayProtocolRevenueSol)}
                    <SolanaLogo width={14} height={14} className="inline" />
                  </p>
                </div>

                {/* Admin Fee */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 pr-8">Admin Fee (Since Oct 28)</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatCurrency(revenueCalculations.totalAdminFeeUsd)}</p>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    {formatSol(revenueCalculations.totalAdminFeeSol)}
                    <SolanaLogo width={14} height={14} className="inline" />
                  </p>
                </div>

                {/* Captured Rounds */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 pr-8">Captured Rounds</h3>
                  <p className="text-3xl font-bold text-white mb-1">{revenueCalculations.totalRounds.toLocaleString()}</p>
                  <p className="text-slate-500 text-sm">Since Oct 28, 2025</p>
                </div>

                {/* Combined Revenue */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2 pr-8">Combined Revenue</h3>
                  <p className="text-3xl font-bold text-white mb-1">{formatCurrency(revenueCalculations.combinedRevenueUsd)}</p>
                  <p className="text-slate-500 text-sm flex items-center gap-1">
                    {formatSol(revenueCalculations.combinedRevenueSol)}
                    <SolanaLogo width={14} height={14} className="inline" />
                  </p>
                </div>
              </div>

              {/* Protocol Revenue Over Time Chart */}
              <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 mb-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-slate-100 mb-1">Protocol Revenue Over Time</h2>
                  <p className="text-slate-400 text-sm">10% of mining rewards (9.9% of total deployed SOL)</p>
                </div>
                {revenueCalculations.timeSeriesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart key="protocol-revenue-chart" data={revenueCalculations.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'SOL', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                        tickFormatter={formatChartSol}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'USD', angle: 90, position: 'insideRight', fill: '#94a3b8', style: { fontSize: '12px' } }}
                        tickFormatter={formatChartCurrency}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name.includes('SOL')) {
                            return [formatChartSol(value) + ' SOL', name];
                          }
                          if (name.includes('USD')) {
                            return [formatChartCurrency(value), name];
                          }
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="protocolRevenueSol" stroke="#3b82f6" strokeWidth={2} dot={false} name="Protocol Revenue (SOL)" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="protocolRevenueUsd" stroke="#ec4899" strokeWidth={2} dot={false} name="Protocol Revenue (USD)" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-96 flex items-center justify-center text-slate-400">
                    No chart data available
                  </div>
                )}
              </div>

              {/* Admin Fee Over Time Chart */}
              <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 mb-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-slate-100 mb-1">Admin Fee Over Time</h2>
                  <p className="text-slate-400 text-sm">1% of deployed SOL</p>
                </div>
                {revenueCalculations.timeSeriesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart key="admin-fee-chart" data={revenueCalculations.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'SOL', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                        tickFormatter={formatChartSol}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#94a3b8"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        label={{ value: 'USD', angle: 90, position: 'insideRight', fill: '#94a3b8', style: { fontSize: '12px' } }}
                        tickFormatter={formatChartCurrency}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #475569',
                          borderRadius: '8px',
                          color: '#f1f5f9',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name.includes('SOL')) {
                            return [formatChartSol(value) + ' SOL', name];
                          }
                          if (name.includes('USD')) {
                            return [formatChartCurrency(value), name];
                          }
                          return [value, name];
                        }}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="adminFeeSol" stroke="#a855f7" strokeWidth={2} dot={false} name="Admin Fee (SOL)" isAnimationActive={false} />
                      <Line yAxisId="right" type="monotone" dataKey="adminFeeUsd" stroke="#10b981" strokeWidth={2} dot={false} name="Admin Fee (USD)" isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-96 flex items-center justify-center text-slate-400">
                    No chart data available
                  </div>
                )}
              </div>

              {/* Daily Revenue Breakdown Table */}
              <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 mb-6">
                <h2 className="text-xl font-semibold text-slate-100 mb-1">Daily Revenue Breakdown</h2>
                <p className="text-slate-400 text-sm mb-4">Historical revenue data by day since October 28, 2025</p>
                {revenueCalculations.dailyBreakdown.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-2 text-sm font-semibold text-slate-400">Date</th>
                          <th className="text-right py-2 text-sm font-semibold text-slate-400">Rounds</th>
                          <th className="text-right py-2 text-sm font-semibold text-slate-400">Protocol Rev (SOL)</th>
                          <th className="text-right py-2 text-sm font-semibold text-slate-400">Protocol Rev ($)</th>
                          <th className="text-right py-2 text-sm font-semibold text-slate-400">Admin Fee (SOL)</th>
                          <th className="text-right py-2 text-sm font-semibold text-slate-400">Admin Fee ($)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueCalculations.dailyBreakdown.map((day, idx) => (
                          <tr key={idx} className="border-b border-slate-700/50">
                            <td className="py-2 text-sm text-slate-200">{new Date(day.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })}</td>
                            <td className="py-2 text-sm text-slate-200 text-right">{day.rounds.toLocaleString()}</td>
                            <td className="py-2 text-sm text-blue-400 text-right">
                              <span className="inline-flex items-center gap-1 justify-end">
                                {formatSol(day.protocolRevenueSol)}
                                <SolanaLogo width={12} height={12} className="inline" />
                              </span>
                            </td>
                            <td className="py-2 text-sm text-slate-200 text-right">{formatCurrency(day.protocolRevenueUsd)}</td>
                            <td className="py-2 text-sm text-purple-400 text-right">
                              <span className="inline-flex items-center gap-1 justify-end">
                                {formatSol(day.adminFeeSol)}
                                <SolanaLogo width={12} height={12} className="inline" />
                              </span>
                            </td>
                            <td className="py-2 text-sm text-slate-200 text-right">{formatCurrency(day.adminFeeUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-96 flex items-center justify-center text-slate-400">
                    No data available
                  </div>
                )}
              </div>

              {/* Chart Data Credit - refinORE.com */}
              <div className="w-full flex items-center justify-center pt-4 mb-2 -mx-4 px-4">
                <a
                  href="https://refinore.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <span>Chart breakdowns by</span>
                  <img 
                    src="/refinore-logo.png" 
                    alt="refinORE" 
                    className="h-5 w-auto object-contain"
                    style={{ maxWidth: '80px' }}
                  />
                  <span className="text-slate-400">refinORE.com</span>
                </a>
              </div>

              {/* Powered By - Full width */}
              <div className="w-full flex items-center justify-center pt-6 mt-6 border-t border-slate-700 -mx-4 px-4">
                <a
                  href="https://github.com/Kriptikz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                >
                  <span>Powered by</span>
                  <img 
                    src="/kriptikz-logo.jpg" 
                    alt="Kriptikz" 
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-slate-400">Kriptikz</span>
                </a>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-slate-400">No revenue data available</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Inflation View
  if (currentView === 'inflation') {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-3xl font-bold text-slate-100 mb-1">ORE Inflation Tracker</h1>
            <p className="text-slate-400 text-sm">
              Real-time monitoring of ORE token supply, withdrawals, and buyback activity (
              <a
                href="https://refinore.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-400 transition-colors"
              >
                charts by
                <img 
                  src="/refinore-logo.png" 
                  alt="refinORE" 
                  className="h-5 w-auto object-contain inline"
                  style={{ maxWidth: '80px' }}
                />
                refinORE.com
              </a>
              )
            </p>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400 mb-4">
              Error: {error}
            </div>
          )}

          {inflationLoading && (!supplyOnMarket || !inflationCurrent || !minted24h) ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading inflation data...</p>
              </div>
            </div>
          ) : supplyOnMarket && inflationCurrent && minted24h ? (
            <>
              {/* Info Box */}
              <div className="mb-4 p-4 bg-slate-800/50 border border-teal-500/30 rounded-lg">
                <p className="text-slate-300 text-sm leading-relaxed">
                  In the last 24 hours, <strong className="text-white inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded inline" /> {formatOre(minted24h.oreMinted)}</strong> has been minted through mining ({minted24h.roundCount.toLocaleString()} rounds). However, this ORE is emitted as "Unrefined" and is kept within the protocol unless miners choose to pay a 10% tax and claim it. Therefore, this tracker only treats ORE that is actually <strong className="text-white">withdrawn</strong> as inflation entering the market.
                </p>
              </div>

              {/* Main Cards Row - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {/* Total Supply Card */}
                <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Total Supply</h3>
                  <p className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                    {formatOre(supplyOnMarket.totalSupply)}
                  </p>
                  <p className="text-slate-500 text-sm mb-3">Current circulating supply</p>
                </div>

                {/* Supply on Market Card */}
                <div className="bg-[#21252C] border-2 border-blue-500 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Supply on Market</h3>
                  <p className="text-3xl font-bold text-blue-400 mb-2 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                    {formatOre(supplyOnMarket.supplyOnMarket)}
                  </p>
                  <p className="text-slate-500 text-sm mb-2">Available for sale (Total - Locked)</p>
                  <div className="space-y-1 text-sm mb-2">
                    <p className="text-slate-400">Staked: <span className="text-white inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> {formatOre(supplyOnMarket.stakedTotal)}</span></p>
                    <p className="text-slate-400">Unrefined: <span className="text-white inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> {formatOre(supplyOnMarket.unclaimedTotal)}</span></p>
                    <p className="text-slate-400">Refined (fees): <span className="text-white inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> {formatOre(supplyOnMarket.refinedTotal)}</span></p>
                  </div>
                </div>

                {/* Net Market Inflation Card - moved here */}
                <div className="bg-[#21252C] border-2 border-blue-500 rounded-lg p-5 relative">
                  <div className="absolute top-4 right-4">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h3 className="text-slate-400 text-sm font-medium mb-2">Net Market Inflation</h3>
                  <p className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                    <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                    {formatOre(inflationCurrent.netMarketInflation24h)}
                  </p>
                  <p className="text-slate-500 text-sm mb-3">Withdrawn - Buyback</p>
                </div>
              </div>

              {/* 24h ORE Flow Section */}
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-white mb-4">24h ORE Flow</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Withdrawn Card */}
                  <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                    <div className="absolute top-4 right-4">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </div>
                    <h3 className="text-slate-400 text-sm font-medium mb-2">Withdrawn</h3>
                    <p className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(inflationCurrent.withdrawn24h)}
                    </p>
                    <p className="text-slate-500 text-sm mb-3">Claimed and moved to market</p>
                  </div>

                  {/* Buyback Card */}
                  <div className="bg-[#21252C] border border-slate-700 rounded-lg p-5 relative">
                    <div className="absolute top-4 right-4">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-slate-400 text-sm font-medium mb-2">Buyback</h3>
                    <p className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                      <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                      {formatOre(inflationCurrent.buyback24h)}
                    </p>
                    <p className="text-slate-500 text-sm mb-3">Removed from circulation</p>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              {netEmissions.length > 0 && (
                <>
                  {/* Net Emissions Line Chart */}
                  <div className="mb-4 bg-[#21252C] border border-slate-700 rounded-lg p-5">
                    <h2 className="text-xl font-semibold text-white mb-2">Net Emissions Per Round</h2>
                    <p className="text-slate-400 text-sm mb-4">
                      Shows net ORE emissions per round: 1.2 ORE emitted minus ORE buyback potential from protocol fees. Positive values = inflationary, Negative = deflationary. The 20-round MA (cyan) shows short-term detail while the 100-round MA (gold) highlights the long-term trend.
                    </p>
                    <div className="h-80 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                          data={netEmissionsChartData}
                          key={`chart-${netEmissionsChartData.length}`}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="roundLabel" 
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            interval="preserveStartEnd"
                            tick={{ fill: '#9CA3AF' }}
                          />
                          <YAxis 
                            stroke="#9CA3AF"
                            style={{ fontSize: '12px' }}
                            tick={{ fill: '#9CA3AF' }}
                            label={{ value: 'ORE', angle: -90, position: 'insideLeft', style: { fill: '#9CA3AF' } }}
                            domain={['dataMin - 0.5', 'dataMax + 0.5']}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1F2937',
                              border: '1px solid #374151',
                              borderRadius: '8px',
                              color: '#F3F4F6'
                            }}
                            formatter={(value: number) => [`${value.toFixed(2)} ORE`, '']}
                          />
                          <Legend />
                          <Line 
                            type="monotone" 
                            dataKey="ma20" 
                            stroke="#06b6d4" 
                            strokeWidth={2}
                            name="20-round MA"
                            dot={false}
                            isAnimationActive={false}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="ma100" 
                            stroke="#eab308" 
                            strokeWidth={2}
                            name="100-round MA (Trend)"
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Round Breakdown Donut Charts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* All Time */}
                    {(() => {
                      const { deflationary, inflationary, total } = roundBreakdownData.allTime;
                      const deflationaryPct = total > 0 ? (deflationary / total * 100) : 0;
                      const inflationaryPct = total > 0 ? (inflationary / total * 100) : 0;
                      const data = [
                        { name: 'Deflationary', value: deflationary, percentage: deflationaryPct, color: '#10b981' },
                        { name: 'Inflationary', value: inflationary, percentage: inflationaryPct, color: '#ef4444' }
                      ].filter(d => d.value > 0); // Filter out zero values
                      
                      return (
                        <div key="all-time" className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                          <h3 className="text-lg font-semibold text-white mb-2">All Time Round Breakdown</h3>
                          <p className="text-slate-400 text-sm mb-4">Distribution of {total.toLocaleString()} rounds</p>
                          <div className="h-56 flex flex-col items-center justify-center">
                            {data.length > 0 ? (
                              <PieChart width={180} height={180}>
                                <Pie
                                  data={data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  dataKey="value"
                                  isAnimationActive={false}
                                >
                                  {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#1F2937',
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#F3F4F6'
                                  }}
                                  formatter={(value: number, name: string, props: any) => [
                                    `${props.payload.percentage.toFixed(1)}% (${value} rounds)`,
                                    name
                                  ]}
                                />
                              </PieChart>
                            ) : (
                              <div className="text-slate-400 text-xs">No data available</div>
                            )}
                            <div className="mt-4 space-y-1 text-center">
                              <p className="text-sm">
                                <span className="text-green-400">Deflationary: {deflationaryPct.toFixed(1)}%</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-red-400">Inflationary: {inflationaryPct.toFixed(1)}%</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 1 Day */}
                    {(() => {
                      const { deflationary, inflationary, total } = roundBreakdownData.oneDay;
                      const deflationaryPct = total > 0 ? (deflationary / total * 100) : 0;
                      const inflationaryPct = total > 0 ? (inflationary / total * 100) : 0;
                      const data = [
                        { name: 'Deflationary', value: deflationary, percentage: deflationaryPct, color: '#10b981' },
                        { name: 'Inflationary', value: inflationary, percentage: inflationaryPct, color: '#ef4444' }
                      ].filter(d => d.value > 0); // Filter out zero values
                      
                      return (
                        <div key="1-day" className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                          <h3 className="text-lg font-semibold text-white mb-2">1 Day Round Breakdown</h3>
                          <p className="text-slate-400 text-sm mb-4">Last {total.toLocaleString()} rounds</p>
                          <div className="h-56 flex flex-col items-center justify-center">
                            {data.length > 0 ? (
                              <PieChart width={180} height={180}>
                                <Pie
                                  data={data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  dataKey="value"
                                  isAnimationActive={false}
                                >
                                  {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#1F2937',
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#F3F4F6'
                                  }}
                                  formatter={(value: number, name: string, props: any) => [
                                    `${props.payload.percentage.toFixed(1)}% (${value} rounds)`,
                                    name
                                  ]}
                                />
                              </PieChart>
                            ) : (
                              <div className="text-slate-400 text-xs">No data available</div>
                            )}
                            <div className="mt-4 space-y-1 text-center">
                              <p className="text-sm">
                                <span className="text-green-400">Deflationary: {deflationaryPct.toFixed(1)}%</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-red-400">Inflationary: {inflationaryPct.toFixed(1)}%</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 7 Day */}
                    {(() => {
                      const { deflationary, inflationary, total } = roundBreakdownData.sevenDay;
                      const deflationaryPct = total > 0 ? (deflationary / total * 100) : 0;
                      const inflationaryPct = total > 0 ? (inflationary / total * 100) : 0;
                      const data = [
                        { name: 'Deflationary', value: deflationary, percentage: deflationaryPct, color: '#10b981' },
                        { name: 'Inflationary', value: inflationary, percentage: inflationaryPct, color: '#ef4444' }
                      ].filter(d => d.value > 0); // Filter out zero values
                      
                      return (
                        <div key="7-day" className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                          <h3 className="text-lg font-semibold text-white mb-2">7 Day Round Breakdown</h3>
                          <p className="text-slate-400 text-sm mb-4">Last {total.toLocaleString()} rounds</p>
                          <div className="h-56 flex flex-col items-center justify-center">
                            {data.length > 0 ? (
                              <PieChart width={180} height={180}>
                                <Pie
                                  data={data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  dataKey="value"
                                  isAnimationActive={false}
                                >
                                  {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#1F2937',
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#F3F4F6'
                                  }}
                                  formatter={(value: number, name: string, props: any) => [
                                    `${props.payload.percentage.toFixed(1)}% (${value} rounds)`,
                                    name
                                  ]}
                                />
                              </PieChart>
                            ) : (
                              <div className="text-slate-400 text-xs">No data available</div>
                            )}
                            <div className="mt-4 space-y-1 text-center">
                              <p className="text-sm">
                                <span className="text-green-400">Deflationary: {deflationaryPct.toFixed(1)}%</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-red-400">Inflationary: {inflationaryPct.toFixed(1)}%</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* 1 Month */}
                    {(() => {
                      const { deflationary, inflationary, total } = roundBreakdownData.oneMonth;
                      const deflationaryPct = total > 0 ? (deflationary / total * 100) : 0;
                      const inflationaryPct = total > 0 ? (inflationary / total * 100) : 0;
                      const data = [
                        { name: 'Deflationary', value: deflationary, percentage: deflationaryPct, color: '#10b981' },
                        { name: 'Inflationary', value: inflationary, percentage: inflationaryPct, color: '#ef4444' }
                      ].filter(d => d.value > 0); // Filter out zero values
                      
                      return (
                        <div key="1-month" className="bg-[#21252C] border border-slate-700 rounded-lg p-5">
                          <h3 className="text-lg font-semibold text-white mb-2">1 Month Round Breakdown</h3>
                          <p className="text-slate-400 text-sm mb-4">Last {total.toLocaleString()} rounds</p>
                          <div className="h-56 flex flex-col items-center justify-center">
                            {data.length > 0 ? (
                              <PieChart width={180} height={180}>
                                <Pie
                                  data={data}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={70}
                                  dataKey="value"
                                  isAnimationActive={false}
                                >
                                  {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: '#1F2937',
                                    border: '1px solid #374151',
                                    borderRadius: '8px',
                                    color: '#F3F4F6'
                                  }}
                                  formatter={(value: number, name: string, props: any) => [
                                    `${props.payload.percentage.toFixed(1)}% (${value} rounds)`,
                                    name
                                  ]}
                                />
                              </PieChart>
                            ) : (
                              <div className="text-slate-400 text-xs">No data available</div>
                            )}
                            <div className="mt-4 space-y-1 text-center">
                              <p className="text-sm">
                                <span className="text-green-400">Deflationary: {deflationaryPct.toFixed(1)}%</span>
                              </p>
                              <p className="text-sm">
                                <span className="text-red-400">Inflationary: {inflationaryPct.toFixed(1)}%</span>
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <p className="text-slate-400">No inflation data available</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Chart Data Credit - refinORE.com */}
        <div className="w-full flex items-center justify-center pt-4 mb-2 -mx-4 px-4">
          <a
            href="https://refinore.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            <span>Chart breakdowns by</span>
            <img 
              src="/refinore-logo.png" 
              alt="refinORE" 
              className="h-6 w-auto object-contain"
              style={{ maxWidth: '100px' }}
            />
            <span className="text-slate-400">refinORE.com</span>
          </a>
        </div>
        
        {/* Powered By - Bottom of inflation page - Full width */}
        <div className="w-full flex items-center justify-center pt-6 mt-6 border-t border-slate-700 -mx-4 px-4">
          <a
            href="https://github.com/Kriptikz"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            <span>Powered by</span>
            <img 
              src="/kriptikz-logo.jpg" 
              alt="Kriptikz" 
              className="w-5 h-5 rounded"
            />
            <span className="text-slate-400">Kriptikz</span>
          </a>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Treasury</h1>
          <p className="text-slate-400 break-words">
            Wallet:{' '}
            <a
              href={`https://solscan.io/account/${TREASURY_WALLET}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-mono text-sm underline transition-colors break-all"
            >
              {TREASURY_WALLET}
            </a>
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error loading data</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {treasuryLoading && treasuryData.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
              <p className="text-slate-400">Loading treasury data...</p>
            </div>
          </div>
        ) : treasuryData.length > 0 ? (
          <>
            {/* Supply Statistics - Hidden for now */}
            {false && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Total Supply Card */}
              <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-100">Total Supply</h2>
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                {supplyStats ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <img 
                        src="/orelogo.jpg" 
                        alt="ORE" 
                        className="w-6 h-6 rounded"
                      />
                      <p className="text-3xl font-bold text-slate-100 flex items-center gap-2">
                        <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                        {formatOre(supplyStats!.totalSupply)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-400">Current circulating supply</p>
                  </>
                ) : null}
              </div>

              {/* Supply on Market Card */}
              <div className="bg-[#21252C] rounded-lg p-6 border border-blue-400/50">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-slate-100">Supply on Market</h2>
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                {supplyStats ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <img 
                        src="/orelogo.jpg" 
                        alt="ORE" 
                        className="w-6 h-6 rounded"
                      />
                      <p className="text-3xl font-bold text-slate-100 flex items-center gap-2">
                        <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
                        {formatOre(supplyStats!.supplyOnMarket)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">Available for sale (Total - Locked)</p>
                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-700">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Staked:</span>
                        <div className="flex items-center gap-1.5">
                          <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 rounded" />
                          <span className="text-sm font-semibold text-slate-200 inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> {formatOre(supplyStats!.totalStaked)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Unrefined:</span>
                        <div className="flex items-center gap-1.5">
                          <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 rounded" />
                          <span className="text-sm font-semibold text-slate-200 inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> {formatOre(supplyStats!.totalUnclaimed)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-400">Refined (fees):</span>
                        <div className="flex items-center gap-1.5">
                          <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 rounded" />
                          <span className="text-sm font-semibold text-slate-200 inline-flex items-center gap-1"><img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" /> {formatOre(supplyStats!.totalRefined)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* 24h ORE Flow */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-100 mb-4">24h ORE Flow</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Withdrawn Card */}
                <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">Withdrawn</h3>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  {flowStats ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <img 
                          src="/orelogo.jpg" 
                          alt="ORE" 
                          className="w-5 h-5 rounded"
                        />
                        <p className="text-2xl font-bold text-slate-100">
                          {flowStats!.withdrawn >= 1000 ? formatOre(flowStats!.withdrawn) : formatOreSmall(flowStats!.withdrawn)}
                        </p>
                        <span className="text-xl font-bold text-slate-100">ORE</span>
                      </div>
                      <p className="text-sm text-slate-400">Claimed and moved to market</p>
                    </>
                  ) : null}
                </div>

                {/* Buyback Card */}
                <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">Buyback</h3>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  {flowStats ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <img 
                          src="/orelogo.jpg" 
                          alt="ORE" 
                          className="w-5 h-5 rounded"
                        />
                        <p className="text-2xl font-bold text-slate-100">
                          {flowStats!.buyback >= 1000 ? formatOre(flowStats!.buyback) : formatOreSmall(flowStats!.buyback)}
                        </p>
                        <span className="text-xl font-bold text-slate-100">ORE</span>
                      </div>
                      <p className="text-sm text-slate-400">Removed from circulation</p>
                    </>
                  ) : null}
                </div>

                {/* Net Market Inflation Card */}
                <div className="bg-[#21252C] rounded-lg p-6 border border-blue-400/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-100">Net Market Inflation</h3>
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  {flowStats ? (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <img 
                          src="/orelogo.jpg" 
                          alt="ORE" 
                          className="w-5 h-5 rounded"
                        />
                        <p className={`text-2xl font-bold ${
                          flowStats!.netMarketInflation >= 0 ? 'text-red-400' : 'text-green-400'
                        }`}>
                          {Math.abs(flowStats!.netMarketInflation) >= 1000 
                            ? formatOre(Math.abs(flowStats!.netMarketInflation)) 
                            : formatOreSmall(Math.abs(flowStats!.netMarketInflation))}
                        </p>
                        <span className="text-xl font-bold text-slate-100">ORE</span>
                      </div>
                      <p className="text-sm text-slate-400">Withdrawn - Buyback</p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Treasury Balance Chart */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Treasury HaWG Over Time</h2>
              {chartData.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Current</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <SolanaLogo width={20} height={20} />
                    <p className="text-lg font-bold text-slate-100">
                      {formatSol(displayBalance)}
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-80 text-slate-400">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="timeAgo"
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    label={{ value: 'Balance (SOL)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value: number) => [`${formatSol(value)} SOL`, 'Balance']}
                  />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 }}
                    isAnimationActive={false}
                    animationDuration={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Total Unclaimed Chart */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Total Unclaimed Over Time</h2>
              {chartData.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Current</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-5 h-5 rounded"
                    />
                    <p className="text-lg font-bold text-slate-100">
                      {formatOre(chartData[chartData.length - 1]?.totalUnclaimed || 0)}
                    </p>
                    <span className="text-lg font-bold text-slate-100">ORE</span>
                  </div>
                </div>
              )}
            </div>
            
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-80 text-slate-400">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="timeAgo"
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={formatOreAxis}
                    label={{ value: 'Unclaimed (ORE)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value: number) => [`${formatOre(value)}`, 'Total Unclaimed']}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalUnclaimed"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 }}
                    isAnimationActive={false}
                    animationDuration={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Total Refined Chart */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Total Refined Over Time</h2>
              {chartData.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Current</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-5 h-5 rounded"
                    />
                    <p className="text-lg font-bold text-slate-100">
                      {formatOre(chartData[chartData.length - 1]?.totalRefined || 0)}
                    </p>
                    <span className="text-lg font-bold text-slate-100">ORE</span>
                  </div>
                </div>
              )}
            </div>
            
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-80 text-slate-400">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="timeAgo"
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={formatOreAxis}
                    label={{ value: 'Refined (ORE)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value: number) => [`${formatOre(value)}`, 'Total Refined']}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalRefined"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 }}
                    isAnimationActive={false}
                    animationDuration={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Total Staked Chart */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-slate-100">Total Staked Over Time</h2>
              {chartData.length > 0 && (
                <div className="text-right">
                  <p className="text-xs text-slate-400 mb-1">Current</p>
                  <div className="flex items-center justify-end gap-1.5">
                    <img 
                      src="/orelogo.jpg" 
                      alt="ORE" 
                      className="w-5 h-5 rounded"
                    />
                    <p className="text-lg font-bold text-slate-100">
                      {formatOre(chartData[chartData.length - 1]?.totalStaked || 0)}
                    </p>
                    <span className="text-lg font-bold text-slate-100">ORE</span>
                  </div>
                </div>
              )}
            </div>
            
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-80 text-slate-400">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  data={chartData} 
                  margin={{ top: 5, right: 20, left: 10, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="timeAgo"
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickFormatter={formatOreAxis}
                    label={{ value: 'Staked (ORE)', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      color: '#f1f5f9',
                    }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label}`}
                    formatter={(value: number) => [`${formatOre(value)}`, 'Total Staked']}
                  />
                  <Line
                    type="monotone"
                    dataKey="totalStaked"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3b82f6', stroke: '#1e40af', strokeWidth: 2 }}
                    isAnimationActive={false}
                    animationDuration={0}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
            {/* Powered By - Bottom of treasury page - Full width */}
            <div className="w-full flex items-center justify-center pt-6 mt-6 border-t border-slate-700 -mx-4 px-4">
              <a
                href="https://github.com/Kriptikz"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                <span>Powered by</span>
                <img 
                  src="/kriptikz-logo.jpg" 
                  alt="Kriptikz" 
                  className="w-5 h-5 rounded"
                />
                <span className="text-slate-400">Kriptikz</span>
              </a>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <p className="text-slate-400">No treasury data available</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

