// API Base URL
export const API_BASE_URL = 'https://ore-api.gmore.fun';

// Treasury Snapshot
export interface TreasurySnapshot {
  observedAt: string;
  motherlodeFormatted: string;
}

// Mining Details
export interface MiningDetails {
  startSlot: string;
  endSlot: string;
  remainingSlots: string;
  status: 'idle' | 'active' | 'finished' | 'expired';
}

// Round Totals
export interface RoundTotals {
  deployedSol: string;
  vaultedSol: string;
  winningsSol: string;
}

// Round Per-Square Data
export interface RoundPerSquare {
  counts: string[];
  deployedSol: string[];
}

// Round Snapshot
export interface RoundSnapshot {
  observedAt: string;
  roundId: string;
  mining: MiningDetails;
  uniqueMiners: string;
  totals: RoundTotals;
  perSquare: RoundPerSquare;
}

// Price Snapshot
export interface PriceSnapshot {
  observedAt: string;
  priceUsdRaw: string;
}

// Round Result Snapshot
export interface RoundResultSnapshot {
  roundId: string;
  resultAvailable: boolean;
  status: string;
  winningSquareLabel: string;
  winningSquareIndex?: number;
  motherlodeHit: boolean;
  motherlodeFormatted: string;
  totalDeployedSol: string;
  totalVaultedSol: string;
  totalWinningsSol: string;
  individualWinner?: string;
  individualWinnerAddress?: string;
}

// Complete State Response
export interface StateResponse {
  treasury: TreasurySnapshot | null;
  round: RoundSnapshot | null;
  currentSlot: string | null;
  orePrice: PriceSnapshot | null;
  solPrice: PriceSnapshot | null;
  roundResult: RoundResultSnapshot | null;
}

// Bid Entry
export interface BidEntry {
  square: number;
  amountRaw: string;
  amountSol: string;
  count: number;
}

// Bids Response
export interface BidsResponse {
  roundId: string;
  collectedAt: string;
  uniqueMiners: number;
  bids: BidEntry[];
}

// Health Response
export interface HealthResponse {
  status: string;
  treasuryPubkey: string;
  boardPubkey: string;
  hasTreasurySnapshot: boolean;
  hasRoundSnapshot: boolean;
  currentSlot: string | null;
}

// Version Response
export interface VersionResponse {
  version: string;
}

