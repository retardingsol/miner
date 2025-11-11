import type { RoundSnapshot } from '../types/api';

interface RoundCardProps {
  round: RoundSnapshot | null;
  currentSlot: string | null;
}

export function RoundCard({ round, currentSlot }: RoundCardProps) {
  if (!round) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-slate-300">Current Round</h2>
        <p className="text-slate-500">No round data available</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'finished':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'expired':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
      case 'idle':
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    }
  };

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-slate-300">Current Round</h2>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(round.mining.status)}`}>
          {round.mining.status.toUpperCase()}
        </span>
      </div>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Round ID</p>
          <p className="text-lg font-semibold text-slate-200">#{round.roundId}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-400 mb-1">Unique Miners</p>
            <p className="text-lg font-semibold text-slate-200">{round.uniqueMiners}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Remaining Slots</p>
            <p className="text-lg font-semibold text-slate-200">{round.mining.remainingSlots}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-2">Mining Details</p>
          <div className="bg-slate-900/50 rounded p-3 space-y-1 text-sm">
            <p className="text-slate-300">Start Slot: <span className="text-slate-400">{round.mining.startSlot}</span></p>
            <p className="text-slate-300">End Slot: <span className="text-slate-400">{round.mining.endSlot}</span></p>
            {currentSlot && (
              <p className="text-slate-300">Current Slot: <span className="text-slate-400">{currentSlot}</span></p>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-2">Totals</p>
          <div className="bg-slate-900/50 rounded p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Deployed SOL:</span>
              <span className="text-slate-200 font-semibold">{parseFloat(round.totals.deployedSol).toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Vaulted SOL:</span>
              <span className="text-slate-200 font-semibold">{parseFloat(round.totals.vaultedSol).toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Winnings SOL:</span>
              <span className="text-slate-200 font-semibold">{parseFloat(round.totals.winningsSol).toFixed(2)} SOL</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Observed: {new Date(round.observedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

