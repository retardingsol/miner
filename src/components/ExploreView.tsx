import { useEffect, useMemo, useState } from 'react';
import { SolanaLogo } from './SolanaLogo';
import {
  getRounds,
  getSupplyOnMarket,
  getBuybacks,
  getStateFrames,
  getRevenueHistory,
} from '../services/api';

type Tab = 'mining' | 'motherlode' | 'buyback';

interface RoundRecord {
  id: number;
  slot_hash: number[];
  winning_square: number;
  expires_at: number;
  motherlode: number;
  rent_payer: string;
  top_miner: string;
  top_miner_reward: number;
  total_deployed: number;
  total_vaulted: number;
  total_winnings: number;
  created_at: string;
}

interface BuybackRecord {
  timestamp: string;
  solSpent: number;
  oreBuried: number;
  stakingYield: number;
}

const MAX_SUPPLY = 5_000_000;

const formatRelativeTime = (timestamp: string | number) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return '—';
  const diff = Date.now() - parsed.getTime();
  if (diff < 0) return 'just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const formatSolValue = (value: number) => {
  if (!Number.isFinite(value)) return '0.0000';
  return value.toFixed(4);
};

const truncateAddress = (address: string | undefined) => {
  if (!address) return '—';
  if (address.includes(' ')) return address;
  if (address.length <= 12) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

export function ExploreView() {
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [frames, setFrames] = useState<any[]>([]);
  const [buybacks, setBuybacks] = useState<BuybackRecord[]>([]);
  const [circulatingSupply, setCirculatingSupply] = useState<number | null>(null);
  const [buried7d, setBuried7d] = useState<number>(0);
  const [protocolRevenue7d, setProtocolRevenue7d] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<Tab>('mining');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [roundData, framesData, supplyData, buybacksData, revenueData] =
          await Promise.all([
            getRounds(),
            getStateFrames(),
            getSupplyOnMarket(),
            getBuybacks(),
            getRevenueHistory(),
          ]);

        setRounds(roundData.sort((a, b) => b.id - a.id));
        setFrames(framesData);
        const normalizedBuybacks = buybacksData
          .map(record => ({
            timestamp: record.timestamp || new Date().toISOString(),
            solSpent: record.solSpent,
            oreBuried: record.oreBuried,
            stakingYield: record.stakingYield,
          }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setBuybacks(normalizedBuybacks);

        const circulating = parseFloat(supplyData.supplyOnMarket || supplyData.totalSupply || '0');
        setCirculatingSupply(Number.isFinite(circulating) ? circulating : null);

        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const buried = normalizedBuybacks.reduce((sum, record) => {
          const time = new Date(record.timestamp).getTime();
          if (!Number.isFinite(time)) return sum;
          return time >= sevenDaysAgo ? sum + record.oreBuried : sum;
        }, 0);
        setBuried7d(buried);

        const lastSevenRevenue = revenueData
          .slice(-7)
          .reduce((sum, entry) => sum + (entry.protocolRevenueSol || 0), 0);
        setProtocolRevenue7d(lastSevenRevenue);
      } catch (err) {
        console.error('ExploreView: failed to load data', err);
        setError(err instanceof Error ? err.message : 'Failed to load explore data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const winnerLookup = useMemo(() => {
    const map = new Map<number, { winnersCount: number; winnerLabel?: string }>();
    frames.forEach(frame => {
      const winner = frame.finalWinner || frame.optimisticWinner;
      const roundId = Number(winner?.roundId ?? frame?.roundId ?? frame?.liveData?.roundId);
      if (!Number.isFinite(roundId)) return;
      const winnersCount = Array.isArray(winner?.winners)
        ? winner.winners.length
        : winner?.winnersCount || (winner?.topMiner ? 1 : 0);
      const label = winner?.topMiner || winner?.winner || winner?.topMinerReward;
      map.set(roundId, { winnersCount, winnerLabel: label });
    });
    return map;
  }, [frames]);

  const miningRows = useMemo(() => rounds.slice(0, 12), [rounds]);
  const motherlodeRows = useMemo(
    () => rounds.filter(r => r.motherlode > 0).slice(0, 12),
    [rounds],
  );
  const buybackRows = useMemo(() => buybacks.slice(0, 12), [buybacks]);

  const stats = [
    {
      label: 'Max Supply',
      value: MAX_SUPPLY.toLocaleString('en-US'),
      unit: 'ORE',
    },
    {
      label: 'Circulating Supply',
      value: circulatingSupply !== null ? circulatingSupply.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—',
      unit: 'ORE',
    },
    {
      label: 'Buried (7d)',
      value: buried7d.toFixed(0),
      unit: 'ORE',
    },
    {
      label: 'Protocol Rev (7d)',
      value: protocolRevenue7d.toFixed(2),
      unit: 'SOL',
    },
  ];

  const renderMiningTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Round</th>
            <th className="py-2 pr-4">Block</th>
            <th className="py-2 pr-4">ORE Winner</th>
            <th className="py-2 pr-4">Winners</th>
            <th className="py-2 pr-4">Deployed</th>
            <th className="py-2 pr-4">Vaulted</th>
            <th className="py-2 pr-4">Winnings</th>
            <th className="py-2 pr-4">Motherlode</th>
            <th className="py-2 pr-4">Time</th>
          </tr>
        </thead>
        <tbody>
          {miningRows.map(row => {
            const winnerMeta = winnerLookup.get(row.id);
            const winnerLabel = winnerMeta?.winnerLabel || row.top_miner || '—';
            const winnersCount = winnerMeta?.winnersCount ?? 0;
            const winnerDisplay =
              winnerLabel === 'Split' || winnersCount > 1
                ? 'Split'
                : truncateAddress(winnerLabel);

            return (
              <tr key={row.id} className="border-t border-slate-800 text-slate-200">
                <td className="py-3 pr-4 font-semibold text-slate-100">#{row.id.toLocaleString()}</td>
                <td className="py-3 pr-4">{`#${row.winning_square}`}</td>
                <td className="py-3 pr-4 text-emerald-300">{winnerDisplay}</td>
                <td className="py-3 pr-4">{winnersCount || '—'}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1">
                    <SolanaLogo width={14} />
                    <span>{formatSolValue(row.total_deployed)}</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1">
                    <SolanaLogo width={14} />
                    <span>{formatSolValue(row.total_vaulted)}</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1">
                    <SolanaLogo width={14} />
                    <span>{formatSolValue(row.total_winnings)}</span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-1">
                    <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                    <span>{row.motherlode}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-slate-400">{formatRelativeTime(row.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderMotherlodeTable = () => (
    <div className="overflow-x-auto">
      {motherlodeRows.length === 0 ? (
        <p className="text-sm text-slate-400">No motherlode events in the selected history window.</p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Round</th>
              <th className="py-2 pr-4">Motherlode</th>
              <th className="py-2 pr-4">Winners</th>
              <th className="py-2 pr-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {motherlodeRows.map(row => {
              const winnerMeta = winnerLookup.get(row.id);
              const winnersCount = winnerMeta?.winnersCount ?? 0;
              return (
                <tr key={`motherlode-${row.id}`} className="border-t border-slate-800 text-slate-200">
                  <td className="py-3 pr-4 font-semibold text-slate-100">#{row.id.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-emerald-300">
                    <div className="flex items-center gap-1">
                      <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                      <span>{row.motherlode}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4">{winnersCount || '—'}</td>
                  <td className="py-3 pr-4 text-slate-400">{formatRelativeTime(row.created_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderBuybackTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4">Time</th>
            <th className="py-2 pr-4">SOL Spent</th>
            <th className="py-2 pr-4">ORE Buried</th>
            <th className="py-2 pr-4">Staking yield</th>
          </tr>
        </thead>
        <tbody>
          {buybackRows.map((row, index) => (
            <tr key={`buyback-${index}`} className="border-t border-slate-800 text-slate-200">
              <td className="py-3 pr-4 text-slate-400">{formatRelativeTime(row.timestamp)}</td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-1">
                  <SolanaLogo width={14} />
                  <span>{row.solSpent.toFixed(4)}</span>
                </div>
              </td>
              <td className="py-3 pr-4">
                <div className="flex items-center gap-1">
                  <img src="/orelogo.jpg" alt="ORE" className="w-4 h-4 object-contain rounded" />
                  <span>{row.oreBuried.toFixed(2)}</span>
                </div>
              </td>
              <td className="py-3 pr-4">{row.stakingYield.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-amber-500 mb-4"></div>
          <p className="text-slate-400">Loading Explore data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-4 text-center">
        <p className="text-red-400 font-semibold mb-2">Failed to load Explore data</p>
        <p className="text-slate-400 mb-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <p className="text-sm text-slate-400 uppercase tracking-[0.3em] mb-2">Explore</p>
          <h1 className="text-3xl font-bold text-white">Review protocol stats and activity.</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-xs text-slate-500 uppercase tracking-[0.3em] mb-1">{card.label}</p>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-semibold text-white">{card.value}</h2>
                <span className="text-slate-400 text-sm">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex flex-wrap gap-2 mb-6">
            {(['mining', 'motherlode', 'buyback'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold rounded-full transition ${
                  activeTab === tab
                    ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                    : 'bg-slate-800 border border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                }`}
              >
                {tab === 'mining' ? 'Mining' : tab === 'motherlode' ? 'Motherlode' : 'Buyback'}
              </button>
            ))}
          </div>
          {activeTab === 'mining' && renderMiningTable()}
          {activeTab === 'motherlode' && renderMotherlodeTable()}
          {activeTab === 'buyback' && renderBuybackTable()}
        </div>
      </div>
    </div>
  );
}

