import type { StateResponse, BidsResponse } from '../types/api';
import { SolanaLogo } from './SolanaLogo';

interface SummaryCardsProps {
  state: StateResponse | null;
  bids: BidsResponse | null;
}

export function SummaryCards({ state }: SummaryCardsProps) {
  // Calculate values
  const motherlodeOre = state?.treasury?.motherlodeFormatted || '0';
  const orePrice = state?.orePrice ? parseFloat(state.orePrice.priceUsdRaw) : 0;
  const solPrice = state?.solPrice ? parseFloat(state.solPrice.priceUsdRaw) : 0;
  
  // Extract ORE number from formatted string (e.g., "151.4 ORE" -> 151.4)
  const motherlodeAmount = parseFloat(motherlodeOre.replace(/[^\d.]/g, '')) || 0;
  const motherlodeUsd = motherlodeAmount * orePrice;
  
  const totalDeployedSol = state?.round?.totals.deployedSol 
    ? parseFloat(state.round.totals.deployedSol) 
    : 0;
  const totalDeployedUsd = totalDeployedSol * solPrice;
  
  // Production cost calculation
  // Formula: (Total Deployed SOL × Acquisition Cost Rate) / Assumed ORE per Round
  // Acquisition Cost Rate = 10% protocol revenue + 1% admin fees = 11% (0.11)
  const acquisitionCostRate = 0.11; // 11% total (10% + 1%)
  const oreMinedPerRound = 1.2; // Assumed ORE per round
  
  const productionCostSol = totalDeployedSol > 0
    ? (totalDeployedSol * acquisitionCostRate) / oreMinedPerRound
    : 0;
  const productionCostUsd = productionCostSol * solPrice;
  
  // Buyback volume = Production cost in USD / ORE price
  const buybackVolumeOre = productionCostUsd > 0 && orePrice > 0
    ? (productionCostUsd / orePrice).toFixed(2)
    : '0';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };


  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {/* MOTHERLODE */}
      <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">MOTHERLODE</p>
        <div className="flex items-baseline gap-2">
          <img 
            src="/orelogo.jpg" 
            alt="ORE" 
            className="w-6 h-6 object-contain rounded-lg"
          />
          <span className="text-3xl font-bold text-amber-400">
            {motherlodeAmount.toFixed(1)}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-2">{formatCurrency(motherlodeUsd)}</p>
      </div>

      {/* TOTAL DEPLOYED */}
      <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">TOTAL DEPLOYED</p>
        <div className="flex items-baseline gap-2">
          <SolanaLogo width={32} height={32} />
          <span className="text-3xl font-bold text-slate-100">
            {totalDeployedSol.toFixed(2)}
          </span>
        </div>
        <p className="text-sm text-slate-400 mt-2">{formatCurrency(totalDeployedUsd)}</p>
      </div>

      {/* PRODUCTION COST / UNREFINED ORE */}
      <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">
          PRODUCTION COST / UNREFINED ORE
        </p>
        <p className="text-3xl font-bold text-slate-100">{formatCurrency(productionCostUsd)}</p>
        <p className="text-sm text-slate-400 mt-2">
          {productionCostSol.toFixed(2)} SOL - at {oreMinedPerRound} ORE mined / round
        </p>
      </div>

      {/* BUYBACK VOLUME / ORE MINED */}
      <div className="bg-[#21252C] rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors">
        <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">
          BUYBACK VOLUME / ORE MINED
        </p>
        <p className="text-3xl font-bold text-slate-100">{buybackVolumeOre} ORE</p>
        <p className="text-sm text-slate-400 mt-2">at current market price</p>
      </div>
    </div>
  );
}

