/**
 * Test utility for verifying ORE instruction formats
 * This file helps debug and verify instruction building
 */

import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import {
  createAutomateInstruction,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  createClaimSOLInstruction as _createClaimSOLInstruction_unused,
  deriveAutomationPDA,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ORE_PROGRAM_ID as _ORE_PROGRAM_ID_unused,
  ORE_BOARD,
  ORE_TREASURY,
} from './oreProgram';

/**
 * Test function to log instruction details for debugging
 */
export function logAutomateInstruction(userPubkey: PublicKey, evThresholdBps: number, numBlocks: number, maxSolPerRound: BN, enabled: boolean) {
  console.log('=== Testing Automate Instruction ===');
  console.log('User Pubkey:', userPubkey.toBase58());
  console.log('EV Threshold (bps):', evThresholdBps);
  console.log('Num Blocks:', numBlocks);
  console.log('Max SOL per round (lamports):', maxSolPerRound.toString());
  console.log('Enabled:', enabled);
  
  try {
    const [automationPDA] = deriveAutomationPDA(userPubkey);
    console.log('Automation PDA:', automationPDA.toBase58());
    
    // Map test parameters to createAutomateInstruction parameters
    // This is a placeholder mapping - actual parameters need to be determined from ORE program
    const amount = maxSolPerRound;
    const deposit = new BN(0);
    const fee = new BN(0);
    const mask = new BN((1 << numBlocks) - 1); // Bitmask for numBlocks
    const strategy = enabled ? 1 : 0;
    
    const instruction = createAutomateInstruction(
      userPubkey,
      amount,
      deposit,
      fee,
      mask,
      strategy
    );
    
    console.log('Instruction Program ID:', instruction.programId.toBase58());
    console.log('Number of accounts:', instruction.keys.length);
    console.log('Accounts:');
    instruction.keys.forEach((key, idx) => {
      console.log(`  [${idx}] ${key.pubkey.toBase58()} - Signer: ${key.isSigner}, Writable: ${key.isWritable}`);
    });
    
    console.log('Instruction data length:', instruction.data.length, 'bytes');
    console.log('Instruction data (hex):', Array.from(instruction.data).map(b => b.toString(16).padStart(2, '0')).join(' '));
    console.log('Instruction data (decimal):', Array.from(instruction.data).join(' '));
    
    return instruction;
  } catch (error) {
    console.error('Error creating instruction:', error);
    throw error;
  }
}

/**
 * Test function to verify account order matches expected ORE program format
 */
export function verifyAccountOrder(userPubkey: PublicKey) {
  console.log('=== Verifying Account Order ===');
  
  const [automationPDA] = deriveAutomationPDA(userPubkey);
  const expectedAccounts = [
    { name: 'User authority', pubkey: userPubkey, signer: true, writable: true },
    { name: 'Automation PDA', pubkey: automationPDA, signer: false, writable: true },
    { name: 'Board', pubkey: ORE_BOARD, signer: false, writable: false },
    { name: 'Treasury', pubkey: ORE_TREASURY, signer: false, writable: false },
  ];
  
  console.log('Expected account order:');
  expectedAccounts.forEach((acc, idx) => {
    console.log(`  [${idx}] ${acc.name}: ${acc.pubkey.toBase58()} - Signer: ${acc.signer}, Writable: ${acc.writable}`);
  });
  
  return expectedAccounts;
}

/**
 * Compare our instruction with a real transaction
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function compareWithRealTransaction(_ourInstruction: any, _realTransactionData: string) {
  console.log('=== Comparing with Real Transaction ===');
  // This would compare our instruction data format with actual transaction data
  // For now, this is a placeholder for manual comparison
}

