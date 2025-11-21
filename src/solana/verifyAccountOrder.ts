/**
 * Account Order Verification Utility
 * 
 * This file helps verify that our account order matches the ORE program's expectations.
 * Account order is CRITICAL - any mismatch will cause transaction failures.
 */

import { PublicKey } from '@solana/web3.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ORE_PROGRAM_ID as _ORE_PROGRAM_ID_unused, ORE_BOARD, ORE_TREASURY } from './oreProgram';

/**
 * Expected account order for Automate instruction
 * 
 * Based on Anchor framework patterns and typical ORE program structure:
 * - Signer accounts come first
 * - Writable accounts come before read-only accounts
 * - System accounts (System Program, Rent, etc.) typically come last
 * 
 * TODO: Verify this exact order by:
 * 1. Examining successful automate transactions on-chain
 * 2. Checking ORE program source code if available
 * 3. Testing on devnet and checking error messages
 */
export const AUTOMATE_ACCOUNT_ORDER = {
  USER: 0,                    // Signer, writable - User authority (pays fees, owns automation)
  AUTOMATION_PDA: 1,          // Writable - Automation account (PDA, created/updated)
  BOARD: 2,                   // Read-only - Board account (current round info)
  SYSTEM_PROGRAM: 3,          // Read-only - System program (for account creation)
  RENT_SYSVAR: 4,             // Read-only - Rent sysvar (for rent calculation)
  
  TOTAL_ACCOUNTS: 5,
} as const;

/**
 * Expected account order for ClaimSOL instruction
 * 
 * Based on Anchor framework patterns:
 * - Signer accounts come first
 * - Source/destination accounts for transfers
 * - State accounts that need to be updated
 * - System accounts come last
 * 
 * TODO: Verify this exact order by:
 * 1. Examining successful claim_sol transactions on-chain
 * 2. Checking ORE program source code if available
 * 3. Testing on devnet and checking error messages
 */
export const CLAIM_SOL_ACCOUNT_ORDER = {
  USER: 0,                    // Signer, writable - User authority (receives SOL)
  MINER_PDA: 1,               // Writable - Miner account (PDA, tracks user's round state)
  ROUND_PDA: 2,               // Writable - Round account (PDA, tracks round state)
  BOARD: 3,                   // Read-only - Board account (round info)
  TREASURY: 4,                // Writable - Treasury account (sends SOL to user)
  SYSTEM_PROGRAM: 5,          // Read-only - System program (for SOL transfer)
  
  TOTAL_ACCOUNTS: 6,
} as const;

/**
 * Verify account order for Automate instruction
 * 
 * @param accounts - Array of account pubkeys in the order they appear in the instruction
 * @param userPubkey - Expected user pubkey
 * @param automationPDA - Expected automation PDA
 * @returns Object with verification results
 */
export function verifyAutomateAccountOrder(
  accounts: PublicKey[],
  userPubkey: PublicKey,
  automationPDA: PublicKey
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (accounts.length !== AUTOMATE_ACCOUNT_ORDER.TOTAL_ACCOUNTS) {
    errors.push(`Expected ${AUTOMATE_ACCOUNT_ORDER.TOTAL_ACCOUNTS} accounts, got ${accounts.length}`);
  }
  
  // Verify user is first
  if (accounts.length > AUTOMATE_ACCOUNT_ORDER.USER && !accounts[AUTOMATE_ACCOUNT_ORDER.USER].equals(userPubkey)) {
    errors.push(`Account at index ${AUTOMATE_ACCOUNT_ORDER.USER} should be user pubkey`);
  }
  
  // Verify automation PDA is second
  if (accounts.length > AUTOMATE_ACCOUNT_ORDER.AUTOMATION_PDA && !accounts[AUTOMATE_ACCOUNT_ORDER.AUTOMATION_PDA].equals(automationPDA)) {
    errors.push(`Account at index ${AUTOMATE_ACCOUNT_ORDER.AUTOMATION_PDA} should be automation PDA`);
  }
  
  // Verify board is third
  if (accounts.length > AUTOMATE_ACCOUNT_ORDER.BOARD && !accounts[AUTOMATE_ACCOUNT_ORDER.BOARD].equals(ORE_BOARD)) {
    errors.push(`Account at index ${AUTOMATE_ACCOUNT_ORDER.BOARD} should be ORE_BOARD`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Verify account order for ClaimSOL instruction
 * 
 * @param accounts - Array of account pubkeys in the order they appear in the instruction
 * @param userPubkey - Expected user pubkey
 * @param minerPDA - Expected miner PDA
 * @param roundPDA - Expected round PDA
 * @returns Object with verification results
 */
export function verifyClaimSOLAccountOrder(
  accounts: PublicKey[],
  userPubkey: PublicKey,
  minerPDA: PublicKey,
  roundPDA: PublicKey
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (accounts.length !== CLAIM_SOL_ACCOUNT_ORDER.TOTAL_ACCOUNTS) {
    errors.push(`Expected ${CLAIM_SOL_ACCOUNT_ORDER.TOTAL_ACCOUNTS} accounts, got ${accounts.length}`);
  }
  
  // Verify user is first
  if (accounts.length > CLAIM_SOL_ACCOUNT_ORDER.USER && !accounts[CLAIM_SOL_ACCOUNT_ORDER.USER].equals(userPubkey)) {
    errors.push(`Account at index ${CLAIM_SOL_ACCOUNT_ORDER.USER} should be user pubkey`);
  }
  
  // Verify miner PDA is second
  if (accounts.length > CLAIM_SOL_ACCOUNT_ORDER.MINER_PDA && !accounts[CLAIM_SOL_ACCOUNT_ORDER.MINER_PDA].equals(minerPDA)) {
    errors.push(`Account at index ${CLAIM_SOL_ACCOUNT_ORDER.MINER_PDA} should be miner PDA`);
  }
  
  // Verify round PDA is third
  if (accounts.length > CLAIM_SOL_ACCOUNT_ORDER.ROUND_PDA && !accounts[CLAIM_SOL_ACCOUNT_ORDER.ROUND_PDA].equals(roundPDA)) {
    errors.push(`Account at index ${CLAIM_SOL_ACCOUNT_ORDER.ROUND_PDA} should be round PDA`);
  }
  
  // Verify treasury is fourth
  if (accounts.length > CLAIM_SOL_ACCOUNT_ORDER.TREASURY && !accounts[CLAIM_SOL_ACCOUNT_ORDER.TREASURY].equals(ORE_TREASURY)) {
    errors.push(`Account at index ${CLAIM_SOL_ACCOUNT_ORDER.TREASURY} should be ORE_TREASURY`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log account order for debugging
 */
export function logAccountOrder(
  instructionName: string,
  accounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>
): void {
  console.log(`\n${instructionName} Account Order:`);
  console.log('='.repeat(70));
  accounts.forEach((acc, idx) => {
    const flags = [
      acc.isSigner ? 'S' : '-',
      acc.isWritable ? 'W' : 'R',
    ].join('');
    console.log(`  [${idx}] ${acc.pubkey.toBase58().slice(0, 16)}... [${flags}]`);
  });
  console.log('='.repeat(70));
}

