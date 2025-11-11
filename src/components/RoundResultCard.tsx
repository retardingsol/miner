import type { RoundResultSnapshot } from '../types/api';

interface RoundResultCardProps {
  roundResult: RoundResultSnapshot | null;
}

export function RoundResultCard({ roundResult }: RoundResultCardProps) {
  if (!roundResult || !roundResult.resultAvailable) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h2 className="text-xl font-semibold mb-4 text-slate-300">Last Round Result</h2>
        <p className="text-slate-500">No result available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <h2 className="text-xl font-semibold mb-4 text-slate-300">Last Round Result</h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">Round ID</p>
          <p className="text-lg font-semibold text-slate-200">#{roundResult.roundId}</p>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-1">Winning Square</p>
          <p className="text-3xl font-bold text-green-400">{roundResult.winningSquareLabel}</p>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-1">Motherlode Hit</p>
          <div className="flex items-center gap-2">
            {roundResult.motherlodeHit ? (
              <>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/50">
                  YES
                </span>
                <span className="text-lg font-semibold text-amber-400">{roundResult.motherlodeFormatted}</span>
              </>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400 border border-gray-500/50">
                NO
              </span>
            )}
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-2">Round Totals</p>
          <div className="bg-slate-900/50 rounded p-3 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Deployed SOL:</span>
              <span className="text-slate-200 font-semibold">{parseFloat(roundResult.totalDeployedSol).toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Vaulted SOL:</span>
              <span className="text-slate-200 font-semibold">{parseFloat(roundResult.totalVaultedSol).toFixed(2)} SOL</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Total Winnings SOL:</span>
              <span className="text-slate-200 font-semibold">{parseFloat(roundResult.totalWinningsSol).toFixed(2)} SOL</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-1">Status</p>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/50">
            {roundResult.status.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

