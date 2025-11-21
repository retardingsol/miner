/**
 * Wallet Labels Service
 * 
 * Maps known wallet addresses to their labels/descriptions.
 * Based on known wallets from the ORE ecosystem.
 */

export interface WalletFundingSource {
  label: string;
  sourceAddress: string;
  sourceLabel?: string;
  amount: number;
  timestamp?: string;
  flowType?: string; // e.g., "Jup DCA", "Colosseum Flow", "OreOTC.sol Flow", "Idle $ORE Vault (V2)"
}

// Known wallet labels mapped by full or partial address
export const WALLET_LABELS: Record<string, string> = {
  // Treasury
  '45db2F': 'Treasury Wallet',
  
  // Long-term holders
  'D6bL8W': '8 Months Holder',
  'CtkDcJ': '1 Year Holder',
  'GA97Mb': '1 Year Holder',
  'EeeeY1': '1 Year Holder',
  '3MZwnR': '1 Month Holder',
  
  // Vaults and institutions
  '3KgcHG': 'Colosseum Squads Vault',
  '7fT33j': 'Project0 Defi Vault',
  'J3D3ww': 'ORE V1 Whale',
  '8CRh2P': 'System/HHC Wallet?',
};

// Funding sources for top wallets (based on transaction flow data)
export const WALLET_FUNDING_SOURCES: Record<string, WalletFundingSource[]> = {
  // 8 Months Holder (D6bL8W...iWxFUt)
  'D6bL8W': [{
    label: 'Jup DCA',
    sourceAddress: 'AMy...JeK',
    amount: 17884.10,
    flowType: 'Jup DCA',
  }],
  
  // Colosseum Squads Vault (3KgcHG...kAF9RB)
  '3KgcHG': [{
    label: 'Colosseum',
    sourceAddress: '7Sw...Euv',
    sourceLabel: 'Colosseum',
    amount: 17639.05,
    flowType: 'Colosseum Flow',
  }],
  
  // 1 Year Holder (CtkDcJ...v1Tjod)
  'CtkDcJ': [{
    label: 'Jup DCA',
    sourceAddress: '88n...51J',
    amount: 12395.59,
    flowType: 'Jup DCA',
  }],
  
  // 1 Month Holder (3MZwnR...JB1om4)
  '3MZwnR': [{
    label: 'OreOTC.sol',
    sourceAddress: 'OreOTC.sol',
    amount: 11672.30,
    flowType: 'OreOTC.sol Flow',
  }],
  
  // ORE V1 Whale (J3D3ww...yJ51Wm)
  'J3D3ww': [{
    label: 'Idle $ORE Vault (V2)',
    sourceAddress: '4Lz...VQ9',
    amount: 10391,
    flowType: 'Idle $ORE Vault (V2)',
  }],
  
  // 1 Year Holder (GA97Mb...MK1siX)
  'GA97Mb': [{
    label: 'Jup DCA',
    sourceAddress: '2Gj...TeP',
    amount: 9921,
    flowType: 'Jup DCA',
  }],
  
  // 1 Year Holder (EeeeY1...aAFGrt)
  'EeeeY1': [{
    label: 'Idle $ORE Vault (V2)',
    sourceAddress: '8Wu...2EY',
    amount: 6364,
    flowType: 'Idle $ORE Vault (V2)',
  }],
  
  // Project0 Defi Vault (7fT33j...G4N5Es)
  '7fT33j': [{
    label: 'Multiple Sources',
    sourceAddress: 'Multiple',
    amount: 5160,
    flowType: 'Multiple Sources',
  }],
};

/**
 * Get wallet label for a given address
 */
export function getWalletLabel(address: string): string | null {
  if (!address) return null;
  
  // Check for exact match first
  if (WALLET_LABELS[address]) {
    return WALLET_LABELS[address];
  }
  
  // Check for partial match (first 6 characters)
  const prefix = address.slice(0, 6);
  if (WALLET_LABELS[prefix]) {
    return WALLET_LABELS[prefix];
  }
  
  // Check if address contains any known wallet prefix
  for (const [key, label] of Object.entries(WALLET_LABELS)) {
    if (address.includes(key)) {
      return label;
    }
  }
  
  return null;
}

/**
 * Get profile picture path for a wallet
 */
export function getWalletProfilePicture(address: string): string | null {
  if (!address) return null;
  
  // Keep this dead simple: map by well-known address prefixes
  const prefix = address.slice(0, 6);
  switch (prefix) {
    case '45db2F': // Treasury Wallet
    return '/orelogo.jpg';
    case '3KgcHG': // Colosseum Squads Vault
    return '/colesseum.jpg';
    case '8CRh2P': // System/HHC Wallet
    return '/hhc.jpg';
    case '7fT33j': // Project0 Defi Vault
    return '/project0.jpg';
    default:
      break;
  }
  
  return null;
}

/**
 * Get wallet description/hint based on balance patterns
 * This can be used for wallets without explicit labels
 */
export function getWalletDescription(_address: string, balance: number): string | null {
  // Very large balances might indicate institutional wallets
  if (balance > 15000) {
    return 'Institutional Wallet';
  }
  
  // Large balances might be long-term holders
  if (balance > 10000) {
    return 'Long-term Holder';
  }
  
  return null;
}

/**
 * Get funding sources for a wallet
 */
export function getWalletFundingSources(address: string): WalletFundingSource[] {
  if (!address) return [];
  
  // Primary lookup: by address prefix (first 6 chars)
  const prefix = address.slice(0, 6);
  if (WALLET_FUNDING_SOURCES[prefix]) {
    return WALLET_FUNDING_SOURCES[prefix];
  }
  
  // Secondary lookup: by wallet label → known prefix
  const label = getWalletLabel(address);
  if (label) {
    const labelToPrefix: Record<string, string> = {
      '8 Months Holder': 'D6bL8W',
      'Colosseum Squads Vault': '3KgcHG',
      '1 Year Holder': 'CtkDcJ',
      '1 Month Holder': '3MZwnR',
      'ORE V1 Whale': 'J3D3ww',
      'Treasury Wallet': '45db2F',
      'System/HHC Wallet?': '8CRh2P',
      'Project0 Defi Vault': '7fT33j',
    };
    const mappedPrefix = labelToPrefix[label];
    if (mappedPrefix && WALLET_FUNDING_SOURCES[mappedPrefix]) {
      return WALLET_FUNDING_SOURCES[mappedPrefix];
    }
  }
  
  return [];
}
