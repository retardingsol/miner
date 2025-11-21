/**
 * ORE SDK Wrapper
 * 
 * This file provides JavaScript/TypeScript bindings that match the Rust SDK structure
 * from https://github.com/regolith-labs/ore/tree/master/api/src/sdk.rs
 * 
 * We use the exact same instruction building logic as the Rust SDK to ensure compatibility.
 */

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import BN from 'bn.js';
import {
  ORE_PROGRAM_ID,
  ORE_TREASURY,
  ENTROPY_API_PROGRAM_ID,
  stringToUint8Array,
  encodeU64,
  encodeU32,
} from './oreProgram';
import { ORE_DISCRIMINATORS } from './oreDiscriminators';

// 1-byte enum discriminator (Steel framework style)
// From instruction.rs: Deploy = 6 (u8)
// This matches the Steel framework's instruction! macro format
const DEPLOY_DISCRIMINATOR_ENUM = new Uint8Array([0x06]);

/**
 * Derive Automation PDA
 * From SDK: automation_pda(authority: Pubkey) -> (Pubkey, u8)
 */
export function automationPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('automation'), authority.toBuffer()],
    ORE_PROGRAM_ID
  );
}

/**
 * Derive Miner PDA
 * From SDK: miner_pda(authority: Pubkey) -> (Pubkey, u8)
 */
export function minerPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('miner'), authority.toBuffer()],
    ORE_PROGRAM_ID
  );
}

/**
 * Derive Board PDA
 * From SDK: board_pda() -> (Pubkey, u8)
 */
export function boardPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('board')],
    ORE_PROGRAM_ID
  );
}

/**
 * Derive Round PDA
 * From SDK: round_pda(round_id: u64) -> (Pubkey, u8)
 */
export function roundPDA(roundId: BN | number): [PublicKey, number] {
  const roundIdBN = BN.isBN(roundId) ? roundId : new BN(roundId);
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('round'), encodeU64(roundIdBN)],
    ORE_PROGRAM_ID
  );
}

/**
 * Derive Entropy Var PDA
 * From SDK: entropy_api::state::var_pda(board_address, var_id: u64) -> (Pubkey, u8)
 */
export function entropyVarPDA(boardAddress: PublicKey, varId: BN | number = 0): [PublicKey, number] {
  const varIdBN = BN.isBN(varId) ? varId : new BN(varId);
  return PublicKey.findProgramAddressSync(
    [
      stringToUint8Array('var'),
      boardAddress.toBuffer(),
      encodeU64(varIdBN)
    ],
    ENTROPY_API_PROGRAM_ID // Important: uses Entropy API program ID, not ORE!
  );
}

/**
 * Create Automate instruction
 * From SDK: pub fn automate(signer: Pubkey, amount: u64, deposit: u64, executor: Pubkey, fee: u64, mask: u64, strategy: u8) -> Instruction
 * 
 * This matches the Rust SDK's automate function exactly:
 * https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
 */
export function automate(
  signer: PublicKey,
  amount: BN | number,
  deposit: BN | number,
  executor: PublicKey,
  fee: BN | number,
  mask: BN | number,
  strategy: number // u8
): TransactionInstruction {
  const amountBN = BN.isBN(amount) ? amount : new BN(amount);
  const depositBN = BN.isBN(deposit) ? deposit : new BN(deposit);
  const feeBN = BN.isBN(fee) ? fee : new BN(fee);
  const maskBN = BN.isBN(mask) ? mask : new BN(mask);

  const automationAddress = automationPDA(signer)[0];
  const minerAddress = minerPDA(signer)[0];

  // Build instruction data
  // From SDK.rs: Automate { amount, deposit, fee, mask, strategy }.to_bytes()
  // Based on real transaction analysis: Reset uses 0x09 (1 byte discriminator)
  // Steel uses 1-byte enum discriminant, NOT 8-byte padded!
  // From enum: Automate = 0 (u8)
  const instructionData = new Uint8Array([
    ...ORE_DISCRIMINATORS.AUTOMATE, // Discriminator: 0x00 (1 byte)
    ...encodeU64(amountBN),
    ...encodeU64(depositBN),
    ...encodeU64(feeBN),
    ...encodeU64(maskBN),
    strategy, // u8
  ]);

  // Comprehensive debug logging
  console.group('🔍 AUTOMATE INSTRUCTION DEBUG');
  console.log('📋 Instruction Parameters:');
  console.log('  Signer:', signer.toBase58());
  console.log('  Executor:', executor.toBase58());
  console.log('  Amount (lamports):', amountBN.toString());
  console.log('  Deposit (lamports):', depositBN.toString());
  console.log('  Fee (lamports):', feeBN.toString());
  console.log('  Mask:', maskBN.toString(16), '(hex)');
  console.log('  Strategy:', strategy);
  console.log('');
  console.log('🔑 PDAs:');
  console.log('  Automation PDA:', automationAddress.toBase58());
  console.log('  Miner PDA:', minerAddress.toBase58());
  console.log('');
  console.log('💾 Instruction Data:');
  console.log('  Length:', instructionData.length, 'bytes');
  console.log('  Hex:', Buffer.from(instructionData).toString('hex'));
  console.log('  Discriminator (first byte):', '0x' + instructionData[0].toString(16).padStart(2, '0'));
  console.log('');
  console.log('📝 Accounts (expected order from SDK.rs):');
  const accounts = [
    { name: 'signer', pubkey: signer, isSigner: true, isWritable: true },
    { name: 'automation_address', pubkey: automationAddress, isSigner: false, isWritable: true },
    { name: 'executor', pubkey: executor, isSigner: false, isWritable: true },
    { name: 'miner_address', pubkey: minerAddress, isSigner: false, isWritable: true },
    { name: 'system_program', pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  accounts.forEach((acc, i) => {
    console.log(`  [${i}] ${acc.name.padEnd(20)} ${acc.pubkey.toBase58()} signer=${acc.isSigner} writable=${acc.isWritable}`);
  });
  console.groupEnd();

  // Account order from SDK.rs (exact match):
  // [signer, automation_address, executor, miner_address, system_program]
  return new TransactionInstruction({
    programId: ORE_PROGRAM_ID,
    keys: accounts.map(acc => ({
      pubkey: acc.pubkey,
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(instructionData),
  });
}

/**
 * Create ClaimSOL instruction
 * From SDK: pub fn claim_sol(signer: Pubkey) -> Instruction
 */
export function claimSol(signer: PublicKey): TransactionInstruction {
  const minerAddress = minerPDA(signer)[0];

  // Build instruction data
  // From SDK.rs: ClaimSOL {}.to_bytes()
  // Empty struct - just discriminator
  // Based on real transaction: Steel uses 1-byte enum discriminant
  // From enum: ClaimSOL = 3 (u8)
  const instructionData = new Uint8Array([
    ...ORE_DISCRIMINATORS.CLAIM_SOL, // Discriminator: 0x03 (1 byte)
  ]);

  // Account order from SDK.rs (exact match):
  // [signer, miner_address, system_program]
  return new TransactionInstruction({
    programId: ORE_PROGRAM_ID,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: minerAddress, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(instructionData),
  });
}

/**
 * Create Checkpoint instruction
 * From SDK: pub fn checkpoint(signer: Pubkey, authority: Pubkey, round_id: u64) -> Instruction
 * This is called before deploy in ore_refined
 */
export function checkpoint(
  signer: PublicKey,
  authority: PublicKey,
  roundId: BN | number
): TransactionInstruction {
  const roundIdBN = BN.isBN(roundId) ? roundId : new BN(roundId);

  const minerAddress = minerPDA(authority)[0];
  const boardAddress = boardPDA()[0];
  const roundAddress = roundPDA(roundIdBN)[0];
  // Treasury is a constant address, not a PDA
  const treasuryAddress = ORE_TREASURY;

  // Build instruction data
  // From SDK.rs: Checkpoint {}.to_bytes()
  // Empty struct - just discriminator
  // From enum: Checkpoint = 2 (u8)
  const instructionData = new Uint8Array([
    0x02, // Discriminator: Checkpoint = 2 (1 byte)
  ]);

  // Account order from SDK.rs:
  // [signer, board_address, miner_address, round_address, treasury_address, system_program]
  return new TransactionInstruction({
    programId: ORE_PROGRAM_ID,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: boardAddress, isSigner: false, isWritable: true },
      { pubkey: minerAddress, isSigner: false, isWritable: true },
      { pubkey: roundAddress, isSigner: false, isWritable: true },
      { pubkey: treasuryAddress, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(instructionData),
  });
}

/**
 * Create Deploy instruction
 * From SDK: pub fn deploy(signer: Pubkey, authority: Pubkey, amount: u64, round_id: u64, squares: [bool; 25]) -> Instruction
 */
export function deploy(
  signer: PublicKey,
  authority: PublicKey,
  amount: BN | number,
  roundId: BN | number,
  squares: boolean[] // Array of 25 booleans
): TransactionInstruction {
  if (squares.length !== 25) {
    throw new Error('Squares array must have exactly 25 elements');
  }

  const amountBN = BN.isBN(amount) ? amount : new BN(amount);
  const roundIdBN = BN.isBN(roundId) ? roundId : new BN(roundId);

  const automationAddress = automationPDA(authority)[0];
  const boardAddress = boardPDA()[0];
  const minerAddress = minerPDA(authority)[0];
  const roundAddress = roundPDA(roundIdBN)[0];
  const entropyVarAddress = entropyVarPDA(boardAddress, 0)[0];

  // Convert array of 25 booleans into a 32-bit mask
  let mask = 0;
  for (let i = 0; i < 25; i++) {
    if (squares[i]) {
      mask |= 1 << i;
    }
  }

  // Build instruction data
  // Steel framework format: [discriminator: u8, ...struct_bytes]
  // From instruction.rs: Deploy = 6 (u8), struct is { amount: [u8; 8], squares: [u8; 4] }
  // The instruction! macro prepends the enum discriminator, then the struct data
  // So format is: [0x06, ...amount_le_bytes, ...squares_le_bytes]
  const instructionData = new Uint8Array([
    ...DEPLOY_DISCRIMINATOR_ENUM, // Discriminator: 0x06 (1 byte - enum value)
    ...encodeU64(amountBN),       // amount: u64 (8 bytes, little-endian)
    ...encodeU32(mask),           // squares: u32 (4 bytes, little-endian)
  ]);
  
  // Total length should be: 1 (discriminator) + 8 (amount) + 4 (squares) = 13 bytes
  console.log('🔍 Using Steel framework format (1-byte enum discriminator)');

  // Comprehensive debug logging
  console.group('🔍 DEPLOY INSTRUCTION DEBUG');
  console.log('📋 Instruction Parameters:');
  console.log('  Signer:', signer.toBase58());
  console.log('  Authority:', authority.toBase58());
  console.log('  Amount (lamports):', amountBN.toString());
  console.log('  Round ID:', roundIdBN.toString());
  console.log('  Squares mask:', mask.toString(16), '(hex)');
  console.log('  Squares (booleans):', squares);
  console.log('');
  console.log('🔑 PDAs:');
  console.log('  Automation PDA:', automationAddress.toBase58());
  console.log('  Board PDA:', boardAddress.toBase58());
  console.log('  Miner PDA:', minerAddress.toBase58());
  console.log('  Round PDA:', roundAddress.toBase58());
  console.log('  Entropy Var PDA:', entropyVarAddress.toBase58());
  console.log('  Entropy API Program:', ENTROPY_API_PROGRAM_ID.toBase58());
  console.log('');
  console.log('💾 Instruction Data:');
  console.log('  Length:', instructionData.length, 'bytes');
  console.log('  Hex:', Buffer.from(instructionData).toString('hex'));
  console.log('  Bytes:', Array.from(instructionData).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));
  console.log('  Discriminator (first byte):', '0x' + instructionData[0].toString(16).padStart(2, '0'));
  console.log('  Amount (bytes 1-8):', Array.from(instructionData.slice(1, 9)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));
  console.log('  Mask (bytes 9-12):', Array.from(instructionData.slice(9, 13)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '));
  console.log('');
  console.log('📝 Accounts (expected order from SDK.rs):');
  const accounts = [
    { name: 'signer', pubkey: signer, isSigner: true, isWritable: true },
    { name: 'authority', pubkey: authority, isSigner: false, isWritable: true },
    { name: 'automation_address', pubkey: automationAddress, isSigner: false, isWritable: true },
    { name: 'board_address', pubkey: boardAddress, isSigner: false, isWritable: true },
    { name: 'miner_address', pubkey: minerAddress, isSigner: false, isWritable: true },
    { name: 'round_address', pubkey: roundAddress, isSigner: false, isWritable: true },
    { name: 'system_program', pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { name: 'entropy_var_address', pubkey: entropyVarAddress, isSigner: false, isWritable: true },
    { name: 'entropy_api', pubkey: ENTROPY_API_PROGRAM_ID, isSigner: false, isWritable: false },
  ];
  accounts.forEach((acc, i) => {
    console.log(`  [${i}] ${acc.name.padEnd(20)} ${acc.pubkey.toBase58()} signer=${acc.isSigner} writable=${acc.isWritable}`);
  });
  console.groupEnd();

  // Account order from SDK.rs (exact match):
  // [signer, authority, automation_address, board_address, miner_address, round_address, system_program, entropy_var_address, entropy_api]
  return new TransactionInstruction({
    programId: ORE_PROGRAM_ID,
    keys: accounts.map(acc => ({
      pubkey: acc.pubkey,
      isSigner: acc.isSigner,
      isWritable: acc.isWritable,
    })),
    data: Buffer.from(instructionData),
  });
}

