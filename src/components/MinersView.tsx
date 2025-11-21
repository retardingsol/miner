import { useState, useEffect, useMemo } from 'react';
import { getMinersData } from '../services/api';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

type Timeframe = '3d' | '7d' | '14d' | '30d' | '90d' | 'all';

const TIMEFRAME_OPTIONS: { value: Timeframe; label: string }[] = [
  { value: '3d', label: '3 Days' },
  { value: '7d', label: '7 Days' },
  { value: '14d', label: '14 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
  { value: 'all', label: 'All Time' },
];

// Consistent color palette matching other stat pages (all blues, no pink/purple)
const CHART_COLORS = {
  primary: '#60a5fa', // light blue
  secondary: '#3b82f6', // blue
  tertiary: '#2563eb', // darker blue
  accent: '#1e40af', // darkest blue
};

// Map activity categories to consistent colors
const getActivityColor = (category: string, index: number): string => {
  const categoryLower = category.toLowerCase();
  if (categoryLower.includes('elite')) return CHART_COLORS.accent; // darkest blue
  if (categoryLower.includes('dedicated')) return CHART_COLORS.tertiary; // darker blue
  if (categoryLower.includes('regular')) return CHART_COLORS.secondary; // blue
  if (categoryLower.includes('casual')) return CHART_COLORS.primary; // light blue
  // Fallback based on index
  const colors = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.tertiary, CHART_COLORS.accent];
  return colors[index % colors.length];
};

// Format functions defined outside component for stability
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};

export function MinersView() {
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getMinersData(timeframe);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch miners data');
        console.error('Error fetching miners data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeframe]);

  const formatPercentage = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return `${num.toFixed(2)}%`;
  };

  // Memoize chart data to prevent unnecessary re-renders
  // Hooks must be called unconditionally, so they're before any early returns
  const uniqueOverTimeData = useMemo(() => {
    if (!data || !data.uniqueOverTime) return [];
    return data.uniqueOverTime.map((item: any) => ({
      date: formatDate(item.date),
      value: item.unique_miners,
    }));
  }, [data?.uniqueOverTime]);

  const newPerDayData = useMemo(() => {
    if (!data || !data.newPerDay) return [];
    return data.newPerDay.map((item: any) => ({
      date: formatDate(item.date),
      value: item.new_miners,
    }));
  }, [data?.newPerDay]);

  const newVsReturningData = useMemo(() => {
    if (!data || !data.newVsReturning) return [];
    return data.newVsReturning.map((item: any) => ({
      date: formatDate(item.date),
      new: item.new_miners,
      returning: item.returning_miners,
    }));
  }, [data?.newVsReturning]);

  const activityDistributionData = useMemo(() => {
    if (!data || !data.activityDistribution) return [];
    return data.activityDistribution.map((item: any, index: number) => ({
      ...item,
      color: getActivityColor(item.category, index),
    }));
  }, [data?.activityDistribution]);

  const cohortDeploymentData = useMemo(() => {
    if (!data || !data.cohortDeployment) return [];
    return data.cohortDeployment.map((item: any) => ({
      date: formatDate(item.date),
      new: parseFloat(item.new_avg) || 0,
      returning: parseFloat(item.returning_avg) || 0,
    }));
  }, [data?.cohortDeployment]);

  const retentionFunnelData = useMemo(() => {
    if (!data || !data.retentionFunnel) return [];
    return data.retentionFunnel;
  }, [data?.retentionFunnel]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
            <p className="text-slate-400">Loading miners data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error loading data</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#21252C] rounded-lg p-8 border border-slate-700 text-center">
            <p className="text-slate-400">No data available</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Miners</h1>
          <p className="text-slate-400 mb-4">
            Comprehensive miner statistics and activity analysis
          </p>
          
          {/* Timeframe Selector */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-slate-400">Timeframe:</span>
            <div className="flex items-center gap-2">
              {TIMEFRAME_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeframe(option.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    timeframe === option.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400 font-semibold">Error loading data</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Unique Miners */}
          <div className="bg-[#21252C] rounded-lg p-4 border border-slate-700 relative">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p className="text-sm text-slate-400">Total Unique Miners</p>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats?.totalUnique?.toLocaleString() || '0'}</p>
            <p className="text-xs text-slate-500 mt-1">All-time participants</p>
          </div>

          {/* Active Miners */}
          <div className="bg-[#21252C] rounded-lg p-4 border border-slate-700 relative">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="text-sm text-slate-400">Active Miners</p>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats?.active?.toLocaleString() || '0'}</p>
            <p className="text-xs text-slate-500 mt-1">In selected timeframe</p>
          </div>

          {/* New Miners Today */}
          <div className="bg-[#21252C] rounded-lg p-4 border border-slate-700 relative">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <p className="text-sm text-slate-400">New Miners Today</p>
            </div>
            <p className="text-2xl font-bold text-white">{data.stats?.newToday?.toLocaleString() || '0'}</p>
            <p className="text-xs text-slate-500 mt-1">First-time participants</p>
          </div>

          {/* Retention Rate */}
          <div className="bg-[#21252C] rounded-lg p-4 border border-slate-700 relative">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-slate-400">Retention Rate</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatPercentage(data.stats?.retentionRate || '0')}</p>
            <p className="text-xs text-slate-500 mt-1">Return for 2+ rounds</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Daily Active Unique Miners */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 relative">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Daily Active Unique Miners</h3>
            {uniqueOverTimeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={uniqueOverTimeData}>
                  <defs>
                    <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke={CHART_COLORS.secondary}
                    fillOpacity={1} 
                    fill="url(#colorUnique)"
                    name="Daily Unique Miners"
                    isAnimationActive={true}
                    animationDuration={750}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>

          {/* New Miners Per Day */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 relative">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">New Miners Per Day</h3>
            {newPerDayData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={newPerDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Bar dataKey="value" fill={CHART_COLORS.primary} name="New Miners" isAnimationActive={true} animationDuration={750} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>

          {/* New vs Returning Miners */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 relative">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">New vs Returning Miners</h3>
            {newVsReturningData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={newVsReturningData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend />
                  <Bar dataKey="new" stackId="a" fill={CHART_COLORS.primary} name="New Miners" isAnimationActive={true} animationDuration={750} />
                  <Bar dataKey="returning" stackId="a" fill={CHART_COLORS.secondary} name="Returning Miners" isAnimationActive={true} animationDuration={750} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>

          {/* Miner Activity Distribution */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 relative">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Miner Activity Distribution</h3>
            {activityDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={activityDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry: any) => {
                      const percent = entry.percentage || 0;
                      return percent >= 5 ? `${percent.toFixed(1)}%` : '';
                    }}
                    outerRadius={120}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="category"
                    isAnimationActive={true}
                    animationDuration={750}
                  >
                    {activityDistributionData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    labelStyle={{ color: '#ffffff', fontWeight: 600, marginBottom: '4px' }}
                    itemStyle={{ color: '#ffffff' }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString()} (${props.payload.percentage?.toFixed(1)}%)`,
                      props.payload.category || name
                    ]}
                  />
                  <Legend 
                    formatter={(value, entry: any) => entry.payload.category || value}
                    wrapperStyle={{ fontSize: '13px' }}
                    iconType="square"
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>

          {/* Avg SOL Deployed by Cohort */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 relative">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Avg SOL Deployed by Cohort</h3>
            {cohortDeploymentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart 
                  key={`cohort-${timeframe}-${cohortDeploymentData.length}`}
                  data={cohortDeploymentData}
                  margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="new" 
                    stroke={CHART_COLORS.primary} 
                    strokeWidth={2} 
                    name="New Miners" 
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={true}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="returning" 
                    stroke={CHART_COLORS.secondary} 
                    strokeWidth={2} 
                    name="Returning Miners" 
                    isAnimationActive={false}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>

          {/* Miner Retention Funnel */}
          <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 relative">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Miner Retention Funnel</h3>
            {retentionFunnelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={retentionFunnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis 
                    dataKey="milestone" 
                    type="category" 
                    stroke="#94a3b8"
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    width={100}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    formatter={(value: number) => value.toLocaleString()}
                  />
                  <Bar dataKey="count" fill={CHART_COLORS.primary} name="Miners" isAnimationActive={true} animationDuration={750} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-400">
                No data available
              </div>
            )}
          </div>
        </div>

        {/* Footer Credit - refinORE.com and Kriptikz */}
        <div className="mt-8 pt-6 border-t border-slate-700/50">
          <p className="text-center text-slate-500 text-sm">
            Data provided by{' '}
            <a
              href="https://refinore.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors"
            >
              <img 
                src="/refinore-logo.png" 
                alt="refinORE" 
                className="h-4 w-auto object-contain inline"
                style={{ maxWidth: '60px' }}
              />
              <span>refinORE</span>
            </a>
            {' and '}
            <a
              href="https://github.com/Kriptikz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors"
            >
              <img 
                src="/kriptikz-logo.jpg" 
                alt="Kriptikz" 
                className="h-4 w-4 rounded inline"
              />
              <span>Kriptikz</span>
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

