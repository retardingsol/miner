import type { BidEntry } from '../types/api';

interface BidsCardProps {
  bids: BidEntry[];
  uniqueMiners: number;
  roundId: string;
  collectedAt: string;
}

export function BidsCard({ bids, uniqueMiners, roundId, collectedAt }: BidsCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-300 mb-2">Top Bids</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">Round: <span className="text-slate-200 font-semibold">#{roundId}</span></span>
          <span className="text-slate-400">Miners: <span className="text-slate-200 font-semibold">{uniqueMiners}</span></span>
        </div>
      </div>

      {bids.length === 0 ? (
        <p className="text-slate-500">No bids available</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {bids.slice(0, 10).map((bid, index) => (
            <div
              key={`${bid.square}-${bid.amountRaw}-${index}`}
              className="bg-slate-900/50 rounded p-3 flex items-center justify-between hover:bg-slate-900/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-slate-700 flex items-center justify-center font-semibold text-slate-300">
                  {bid.square}
                </div>
                <div>
                  <p className="text-slate-200 font-semibold">{parseFloat(bid.amountSol).toFixed(2)} SOL</p>
                  <p className="text-xs text-slate-400">{bid.count} miner{bid.count !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          ))}
          {bids.length > 10 && (
            <p className="text-xs text-slate-500 text-center pt-2">
              Showing top 10 of {bids.length} bids
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-4">
        Collected: {new Date(collectedAt).toLocaleString()}
      </p>
    </div>
  );
}

