import type { PriceSnapshot } from '../types/api';

interface PriceCardProps {
  orePrice: PriceSnapshot | null;
  solPrice: PriceSnapshot | null;
}

export function PriceCard({ orePrice, solPrice }: PriceCardProps) {
  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
      <h2 className="text-xl font-semibold mb-4 text-slate-300">Prices</h2>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-slate-400 mb-1">ORE / USD</p>
          {orePrice ? (
            <p className="text-2xl font-bold text-amber-400">
              ${parseFloat(orePrice.priceUsdRaw).toFixed(6)}
            </p>
          ) : (
            <p className="text-slate-500">Unavailable</p>
          )}
        </div>
        <div>
          <p className="text-sm text-slate-400 mb-1">SOL / USD</p>
          {solPrice ? (
            <p className="text-2xl font-bold text-purple-400">
              ${parseFloat(solPrice.priceUsdRaw).toFixed(2)}
            </p>
          ) : (
            <p className="text-slate-500">Unavailable</p>
          )}
        </div>
      </div>
    </div>
  );
}

