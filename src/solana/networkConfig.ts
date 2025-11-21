/**
 * Network Configuration for ORE Program
 * 
 * Different networks may have different program IDs and configurations
 */

import { PublicKey } from '@solana/web3.js';

/**
 * Get the ORE program ID based on the current network
 * 
 * NOTE: The ORE program may not exist on devnet/testnet
 * For devnet testing, you may need to deploy a test version of the ORE program
 */
export function getOreProgramId(): PublicKey {
  // For now, use mainnet program ID even on devnet
  // TODO: Deploy ORE program to devnet or update this to use devnet program ID if available
  return new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');
}

/**
 * Get the ORE Board address based on the current network
 */
export function getOreBoard(): PublicKey {
  return new PublicKey('BrcSxdp1nXFzou1YyDnQJcPNBNHgoypZmTsyKBSLLXzi');
}

/**
 * Get the ORE Treasury address based on the current network
 */
export function getOreTreasury(): PublicKey {
  return new PublicKey('45db2FSR4mcXdSVVZbKbwojU6uYDpMyhpEi7cC8nHaWG');
}

/**
 * Get the ORE Mint address based on the current network
 */
export function getOreMint(): PublicKey {
  return new PublicKey('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp');
}

/**
 * Check if we're on devnet
 */
export function isDevnet(): boolean {
  const endpoint = import.meta.env.VITE_SOLANA_RPC_URL || '';
  const network = import.meta.env.VITE_SOLANA_NETWORK || 'mainnet-beta';
  return endpoint.includes('devnet') || network === 'devnet';
}

