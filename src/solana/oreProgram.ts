/**
 * ORE Program Direct Integration
 * 
 * This file provides direct integration with the ORE mining program.
 * No wrapper program needed - we call ORE program instructions directly.
 * 
 * ORE Program ID: LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
 * ORE Mint: oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp
 */

import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import BN from 'bn.js';
import { ORE_DISCRIMINATORS } from './oreDiscriminators';

// ORE Program ID (found from analyzing transactions)
export const ORE_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

// ORE Token Mint Address
export const ORE_MINT = new PublicKey('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp');

// Treasury wallet (from API/health endpoint)
export const ORE_TREASURY = new PublicKey('45db2FSR4mcXdSVVZbKbwojU6uYDpMyhpEi7cC8nHaWG');

// Board account (from API/health endpoint)
// This holds the round state and board configuration
export const ORE_BOARD = new PublicKey('BrcSxdp1nXFzou1YyDnQJcPNBNHgoypZmTsyKBSLLXzi');

// Entropy API Program ID (found from var address owner)
// The Entropy API program provides verifiable random numbers for the ORE game
export const ENTROPY_API_PROGRAM_ID = new PublicKey('3jSkUuYBoJzQPMEzTvkDFXCZUBksPamrVhrnHR9igu2X');

/**
 * Helper to convert string to Uint8Array (browser-compatible)
 */
export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Helper to encode u64 as little-endian bytes (browser-compatible)
 */
export function encodeU64(value: number | BN): Uint8Array {
  const bn = BN.isBN(value) ? value : new BN(value);
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    // Little-endian: byte 0 = bits 0-7, byte 1 = bits 8-15, etc.
    bytes[i] = bn.shrn(i * 8).and(new BN(0xFF)).toNumber();
  }
  return bytes;
}

/**
 * Helper to encode u32 as little-endian bytes
 */
export function encodeU32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

/**
 * Helper to encode u16 as little-endian bytes (browser-compatible)
 * @internal
 */
export function _encodeU16_unused(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  return bytes;
}

/**
 * Helper to encode u8
 * @internal
 */
export function _encodeU8_unused(value: number): Uint8Array {
  return new Uint8Array([value]);
}

/**
 * Helper to encode bool (as u8: 0 = false, 1 = true)
 * @internal
 */
export function _encodeBool_unused(value: boolean): Uint8Array {
  return new Uint8Array([value ? 1 : 0]);
}

/**
 * Derive Automation PDA
 * Based on ORE program patterns, Automation PDA is likely derived from [user_pubkey, "automation", program_id]
 */
export function deriveAutomationPDA(userPubkey: PublicKey, programId: PublicKey = ORE_PROGRAM_ID): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('automation'), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Create an Automate instruction for the ORE program
 * 
 * Source: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/instruction.rs
 * 
 * ORE uses steel framework, NOT Anchor! The discriminator is just the enum value as a u8 byte.
 * OreInstruction::Automate = 0, so discriminator is [0x00]
 * 
 * The Automate struct is:
 * - amount: [u8; 8] (u64)
 * - deposit: [u8; 8] (u64)
 * - fee: [u8; 8] (u64)
 * - mask: [u8; 8] (u64)
 * - strategy: u8 (NOT u64!)
 * 
 * @param userPubkey - The user's wallet public key
 * @param amount - Amount parameter (u64, in lamports) - maps to maxSolPerRound
 * @param deposit - Deposit amount (u64, in lamports) - initial deposit to automation account
 * @param fee - Fee amount (u64, in lamports) - fee for executor
 * @param mask - Block mask (u64) - bitmask for which blocks to target (1 << blockIndex)
 * @param strategy - Automation strategy (u8, NOT u64!) - strategy enum value
 * @returns TransactionInstruction for the ORE Automate instruction
 */
export function createAutomateInstruction(
  userPubkey: PublicKey,
  amount: BN,
  deposit: BN,
  fee: BN,
  mask: BN,
  strategy: number // u8, not BN!
): TransactionInstruction {
  // Derive Automation PDA
  const [automationPDA] = deriveAutomationPDA(userPubkey);

  // Build instruction data
  // Source: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/instruction.rs
  // Source SDK: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
  // Source CLI: https://raw.githubusercontent.com/regolith-labs/ore-cli (uses SDK directly)
  // 
  // Based on ore-cli: uses ore_api::sdk::automate() which calls Automate { ... }.to_bytes()
  // The .to_bytes() method is generated by steel's instruction! macro.
  // Trying discriminator WITHOUT "global:" prefix - steel might use a different format.
  //
  // Instruction data structure:
  // discriminator (8 bytes) - SHA256("Automate")[:8] (NOT "global:Automate")
  // amount (8 bytes, u64, little-endian) - Amount parameter
  // deposit (8 bytes, u64, little-endian) - Deposit amount in lamports
  // fee (8 bytes, u64, little-endian) - Fee amount
  // mask (8 bytes, u64, little-endian) - Block mask (which blocks to target)
  // strategy (1 byte, u8) - Automation strategy
  //
  // Total: 8 + 8 + 8 + 8 + 8 + 1 = 41 bytes
  
  // Validate strategy is within u8 range
  if (strategy < 0 || strategy > 255) {
    throw new Error('Strategy must be between 0 and 255 (u8)');
  }
  
  // Steel framework might use enum discriminant value directly (not SHA256)
  // From enum: Automate = 0 (u8), encoded as u64 little-endian = 0x0000000000000000
  const instructionData = new Uint8Array([
    ...ORE_DISCRIMINATORS.AUTOMATE, // 8 bytes - Enum discriminant 0 as u64: 0000000000000000
    ...encodeU64(amount), // 8 bytes - u64 little-endian
    ...encodeU64(deposit), // 8 bytes - u64 little-endian
    ...encodeU64(fee), // 8 bytes - u64 little-endian
    ...encodeU64(mask), // 8 bytes - u64 little-endian
    strategy, // 1 byte - u8
  ]);

  // Debug logging - LOG THIS FIRST so it shows before any errors
  console.log('🔍🔍🔍 AUTOMATE INSTRUCTION DEBUG 🔍🔍🔍');
  console.log('Discriminator (first 8 bytes):', Array.from(ORE_DISCRIMINATORS.AUTOMATE).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));
  console.log('Discriminator (hex):', Buffer.from(ORE_DISCRIMINATORS.AUTOMATE).toString('hex'));
  console.log('Full instruction data length:', instructionData.length, 'bytes');
  console.log('Full instruction data (hex):', Buffer.from(instructionData).toString('hex'));
  console.log('First 16 bytes:', Array.from(instructionData.slice(0, 16)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));
  console.log('🔍🔍🔍 END AUTOMATE DEBUG 🔍🔍🔍');

  // Build the instruction
  // Account order is CRITICAL - must match ORE program's account constraints exactly
  // Source: https://raw.githubusercontent.com/regolith-labs/ore/master/program/src/automate.rs
  // From source code: let [signer_info, automation_info, executor_info, miner_info, system_program] = accounts
  //
  // Expected order for ORE "automate" instruction:
  // [0] signer_info - signer, writable (user authority)
  // [1] automation_info - writable (Automation PDA)
  // [2] executor_info - writable (executor account - can be Pubkey::default() to close)
  // [3] miner_info - writable (Miner PDA)
  // [4] system_program - read-only (System Program)
  //
  // PDA derivations from source:
  // - Automation PDA: [AUTOMATION, signer_info.key.to_bytes()]
  // - Miner PDA: [MINER, signer_info.key.to_bytes()]
  
  // Derive Miner PDA (no round_id needed for automate, just user)
  const [minerPDA] = PublicKey.findProgramAddressSync(
    [stringToUint8Array('miner'), userPubkey.toBuffer()],
    ORE_PROGRAM_ID
  );
  
  // Executor can be Pubkey::default() (all zeros) to close automation, or a valid executor pubkey
  // For now, use user's pubkey as executor (they execute their own automation)
  const executorPubkey = userPubkey;
  
  const keys = [
    { pubkey: userPubkey, isSigner: true, isWritable: true }, // [0] signer_info (signer, writable)
    { pubkey: automationPDA, isSigner: false, isWritable: true }, // [1] automation_info (writable)
    { pubkey: executorPubkey, isSigner: false, isWritable: true }, // [2] executor_info (writable)
    { pubkey: minerPDA, isSigner: false, isWritable: true }, // [3] miner_info (writable)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // [4] system_program (read-only)
  ];

  return new TransactionInstruction({
    keys,
    programId: ORE_PROGRAM_ID,
    data: Buffer.from(instructionData),
  });
}

/**
 * Create a ClaimSOL instruction for the ORE program
 * Claims SOL rewards
 * 
 * Based on ORE API SDK: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
 * SDK function: pub fn claim_sol(signer: Pubkey) -> Instruction
 * 
 * @param userPubkey - The user's wallet public key
 * @returns TransactionInstruction for the ORE ClaimSOL instruction
 */
export function createClaimSOLInstruction(
  userPubkey: PublicKey
): TransactionInstruction {
  // Derive Miner PDA for this user
  // Source: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
  // From SDK: let miner_address = miner_pda(signer).0;
  // Miner PDA is derived from: [MINER, signer.to_bytes()] (no round_id needed)
  const [minerPDA] = PublicKey.findProgramAddressSync(
    [
      stringToUint8Array('miner'),
      userPubkey.toBuffer(),
    ],
    ORE_PROGRAM_ID
  );

  // Build instruction data
  // Based on ORE API SDK: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
  // ClaimSOL struct is empty: pub struct ClaimSOL {}
  // Steel framework might use enum discriminant value directly
  // From enum: ClaimSOL = 3 (u8), encoded as u64 little-endian = 0x0300000000000000
  //
  // Total: 8 + 0 = 8 bytes (discriminator only, empty struct)
  const instructionData = new Uint8Array([
    ...ORE_DISCRIMINATORS.CLAIM_SOL, // 8 bytes - Enum discriminant 3 as u64: 0300000000000000
    // No additional data - ClaimSOL struct is empty: pub struct ClaimSOL {}
  ]);

  // Build the instruction
  // Account order is CRITICAL - must match ORE program's account constraints exactly
  // Source: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
  // From SDK: pub fn claim_sol(signer: Pubkey) -> Instruction
  // Accounts: [signer, miner_address, system_program]
  //
  // Expected order for ORE "claim_sol" instruction (from SDK):
  // [0] signer - signer, writable (receives SOL)
  // [1] miner_address - writable (Miner PDA, tracks user's state)
  // [2] system_program - read-only (System Program for SOL transfer)
  //
  // Note: SDK shows only 3 accounts, not 6. The miner PDA is derived from signer only (no round_id needed)
  const keys = [
    { pubkey: userPubkey, isSigner: true, isWritable: true }, // [0] signer (signer, writable, receives SOL)
    { pubkey: minerPDA, isSigner: false, isWritable: true }, // [1] miner_address (writable, Miner PDA)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // [2] system_program (read-only)
  ];

  return new TransactionInstruction({
    keys,
    programId: ORE_PROGRAM_ID,
    data: Buffer.from(instructionData),
  });
}

/**
 * Create a Deploy instruction for mining (placing bets on squares)
 * This is the basic mining instruction that users interact with
 * 
 * Based on: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
 * 
 * @param signer - The signer's wallet public key
 * @param authority - The authority's wallet public key (usually same as signer)
 * @param amount - Amount of SOL to deploy (u64, in lamports)
 * @param roundId - Current round ID (u64)
 * @param squares - Array of 25 booleans representing which squares to bet on (index 0-24)
 * @returns TransactionInstruction for the ORE Deploy instruction
 */
export function createDeployInstruction(
  signer: PublicKey,
  authority: PublicKey,
  amount: BN,
  roundId: BN,
  squares: boolean[] // Array of 25 booleans
): TransactionInstruction {
  if (squares.length !== 25) {
    throw new Error('Squares array must have exactly 25 elements');
  }

  // Derive PDAs
  const [automationPDA] = deriveAutomationPDA(authority);
  const [boardPDA] = PublicKey.findProgramAddressSync(
    [stringToUint8Array('board')],
    ORE_PROGRAM_ID
  );
  const [minerPDA] = PublicKey.findProgramAddressSync(
    [stringToUint8Array('miner'), authority.toBuffer()],
    ORE_PROGRAM_ID
  );
  const [roundPDA] = PublicKey.findProgramAddressSync(
    [stringToUint8Array('round'), encodeU64(roundId)],
    ORE_PROGRAM_ID
  );
  // Derive entropy var PDA using Entropy API program ID (not ORE program ID!)
  // From SDK.rs: entropy_var_address = entropy_api::state::var_pda(board_address, 0).0;
  const [entropyVarPDA] = PublicKey.findProgramAddressSync(
    [
      stringToUint8Array('var'),
      boardPDA.toBuffer(),
      encodeU64(new BN(0)) // var_id = 0
    ],
    ENTROPY_API_PROGRAM_ID // Use Entropy API program ID, not ORE program ID!
  );

  // Use exported encodeU32

  // Convert array of 25 booleans into a 32-bit mask
  // Bit i (0-24) represents whether square i is selected
  let mask = 0;
  for (let i = 0; i < 25; i++) {
    if (squares[i]) {
      mask |= 1 << i;
    }
  }

  // Build instruction data
  // Deploy struct: amount (u64, 8 bytes) + squares (u32, 4 bytes)
  // Discriminator: 8 bytes - Steel might use enum discriminant value directly
  // From enum: Deploy = 6 (u8), encoded as u64 little-endian = 0x0600000000000000
  // Total: 8 + 8 + 4 = 20 bytes
  const instructionData = new Uint8Array([
    ...ORE_DISCRIMINATORS.DEPLOY, // 8 bytes - Enum discriminant 6 as u64: 0600000000000000
    ...encodeU64(amount), // 8 bytes - u64 little-endian
    ...encodeU32(mask), // 4 bytes - u32 little-endian
  ]);


  // Account order from SDK.rs (exact match):
  // signer, authority, automation_address, board_address, miner_address, round_address, system_program, entropy_var_address, entropy_api
  //
  // From SDK.rs:
  // AccountMeta::new(signer, true),           // [0] signer (signer, writable)
  // AccountMeta::new(authority, false),       // [1] authority (writable)
  // AccountMeta::new(automation_address, false), // [2] automation_address (writable)
  // AccountMeta::new(board_address, false),   // [3] board_address (writable) - NOTE: writable, not read-only!
  // AccountMeta::new(miner_address, false),   // [4] miner_address (writable)
  // AccountMeta::new(round_address, false),   // [5] round_address (writable)
  // AccountMeta::new_readonly(system_program::ID, false), // [6] system_program (read-only)
  // AccountMeta::new(entropy_var_address, false), // [7] entropy_var_address (writable)
  // AccountMeta::new_readonly(entropy_api::ID, false), // [8] entropy_api (read-only)
  const keys = [
    { pubkey: signer, isSigner: true, isWritable: true }, // [0] signer (signer, writable)
    { pubkey: authority, isSigner: false, isWritable: true }, // [1] authority (writable)
    { pubkey: automationPDA, isSigner: false, isWritable: true }, // [2] automation_address (writable)
    { pubkey: boardPDA, isSigner: false, isWritable: true }, // [3] board_address (writable) - FIXED: was read-only
    { pubkey: minerPDA, isSigner: false, isWritable: true }, // [4] miner_address (writable)
    { pubkey: roundPDA, isSigner: false, isWritable: true }, // [5] round_address (writable)
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // [6] system_program (read-only)
    { pubkey: entropyVarPDA, isSigner: false, isWritable: true }, // [7] entropy_var_address (writable)
    { pubkey: ENTROPY_API_PROGRAM_ID, isSigner: false, isWritable: false }, // [8] entropy_api (read-only program)
  ];

  return new TransactionInstruction({
    keys,
    programId: ORE_PROGRAM_ID,
    data: Buffer.from(instructionData),
  });
}

/**
 * Create a Claim instruction for the ORE program
 * This instruction places bids on specific squares in a round
 * NOTE: This is for reference - we're focusing on automation, not manual deployments
 * 
 * @param userPubkey - The user's wallet public key
 * @param roundId - The current round ID (u64)
 * @param squareIndex - The square index (0-24) to bid on
 * @param amountLamports - Amount of SOL to bid in lamports
 * @returns TransactionInstruction for the ORE Claim instruction
 */
export function createOreClaimInstruction(
  userPubkey: PublicKey,
  roundId: number | BN,
  squareIndex: number, // 0-24
  amountLamports: BN
): TransactionInstruction {
  // Validate inputs
  if (squareIndex < 0 || squareIndex > 24) {
    throw new Error('Square index must be between 0 and 24');
  }

  // Get user's SOL account (their wallet)
  const userSolAccount = userPubkey;

  // Get user's ORE token account (associated token address)
  const userOreAccount = getAssociatedTokenAddressSync(
    ORE_MINT,
    userPubkey
  );

  // Get treasury ORE token account
  const treasuryOreAccount = getAssociatedTokenAddressSync(
    ORE_MINT,
    ORE_TREASURY
  );

  // Build instruction data
  // Based on typical ORE program structure, the instruction likely has:
  // discriminator (1 byte) - typically 0x00 for Claim
  // round_id (8 bytes, u64)
  // square_index (1 byte, u8) - 0-24
  // amount (8 bytes, u64 lamports)
  
  const instructionData = new Uint8Array([
    0x00, // Discriminator - Claim instruction (needs to be verified)
    ...encodeU64(roundId),
    squareIndex, // u8
    ...encodeU64(amountLamports),
  ]);

  // Build the instruction
  // Account order is critical - needs to match program's expectations
  // Typical order: user authority, user SOL, user ORE, treasury ORE, mint, system program, token program
  const keys = [
    { pubkey: userPubkey, isSigner: true, isWritable: true }, // User authority
    { pubkey: userSolAccount, isSigner: false, isWritable: true }, // User SOL account
    { pubkey: userOreAccount, isSigner: false, isWritable: true }, // User ORE token account
    { pubkey: treasuryOreAccount, isSigner: false, isWritable: true }, // Treasury ORE token account
    { pubkey: ORE_MINT, isSigner: false, isWritable: false }, // ORE mint
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // System program
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Token program
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // Associated token program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }, // Rent sysvar
  ];

  return new TransactionInstruction({
    keys,
    programId: ORE_PROGRAM_ID,
    data: Buffer.from(instructionData),
  });
}

/**
 * Create a Claim instruction for multiple squares in a round
 * This is more efficient than individual transactions for "all25" strategy
 * 
 * @param userPubkey - The user's wallet public key
 * @param roundId - The current round ID (u64)
 * @param squares - Array of square indices (0-24) to bid on
 * @param amountPerSquareLamports - Amount of SOL to bid per square in lamports
 * @returns Array of TransactionInstructions (one per square)
 */
export function createOreClaimInstructions(
  userPubkey: PublicKey,
  roundId: number | BN,
  squares: number[], // Array of 0-24
  amountPerSquareLamports: BN
): TransactionInstruction[] {
  return squares.map(squareIndex => 
    createOreClaimInstruction(userPubkey, roundId, squareIndex, amountPerSquareLamports)
  );
}

/**
 * Build a transaction to claim on multiple squares
 * This creates one transaction with multiple claim instructions
 * 
 * @param userPubkey - The user's wallet public key
 * @param roundId - The current round ID (u64)
 * @param squares - Array of square indices (0-24) to bid on
 * @param totalAmountLamports - Total SOL to split across squares
 * @returns Transaction with all claim instructions
 */
export function createOreClaimTransaction(
  userPubkey: PublicKey,
  roundId: number | BN,
  squares: number[],
  totalAmountLamports: BN
): Transaction {
  const amountPerSquare = totalAmountLamports.div(new BN(squares.length));
  const instructions = createOreClaimInstructions(
    userPubkey,
    roundId,
    squares,
    amountPerSquare
  );

  const transaction = new Transaction();
  instructions.forEach(instruction => transaction.add(instruction));
  
  return transaction;
}

