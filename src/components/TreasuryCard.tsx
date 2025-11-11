import type { TreasurySnapshot } from '../types/api';

interface TreasuryCardProps {
  treasury: TreasurySnapshot | null;
}

export function TreasuryCard({ treasury }: TreasuryCardProps) {
  if (!treasury) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-slate-300">Treasury</h2>
        <p className="text-slate-500">No treasury data available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <h2 className="text-xl font-semibold mb-4 text-slate-300">Treasury</h2>
      <div className="space-y-2">
        <div>
          <p className="text-sm text-slate-400 mb-1">Motherlode</p>
          <p className="text-2xl font-bold text-amber-400">{treasury.motherlodeFormatted}</p>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Observed: {new Date(treasury.observedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

