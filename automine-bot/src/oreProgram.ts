import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import BN from 'bn.js';

// === Core ORE program constants (mirrored from frontend sdk) ===

// ORE program id (mining program)
export const ORE_PROGRAM_ID = new PublicKey(
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
);

// Entropy API program – used for randomization
export const ENTROPY_API_PROGRAM_ID = new PublicKey(
  '3jSkUuYBoJzQPMEzTvkDFXCZUBksPamrVhrnHR9igu2X',
);

// 1‑byte enum discriminator values (Steel framework)
// See frontend `src/solana/oreDiscriminators.ts`
const DEPLOY_DISCRIMINATOR = new Uint8Array([0x06]); // Deploy = 6 (u8)

// === Byte helpers (mirrored from frontend `oreProgram.ts`) ===

export function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function encodeU64(value: BN | number | bigint): Uint8Array {
  const bn =
    value instanceof BN ? value : new BN(typeof value === 'bigint' ? value.toString() : value);
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = bn.shrn(i * 8)
      .and(new BN(0xff))
      .toNumber();
  }
  return bytes;
}

export function encodeU32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  bytes[2] = (value >> 16) & 0xff;
  bytes[3] = (value >> 24) & 0xff;
  return bytes;
}

// === PDA helpers (mirrored from frontend `oreSDK.ts`) ===

export function automationPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('automation'), authority.toBuffer()],
    ORE_PROGRAM_ID,
  );
}

export function minerPDA(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('miner'), authority.toBuffer()],
    ORE_PROGRAM_ID,
  );
}

export function boardPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('board')],
    ORE_PROGRAM_ID,
  );
}

export function roundPDA(roundId: BN | number | bigint): [PublicKey, number] {
  const roundIdBN =
    roundId instanceof BN ? roundId : new BN(typeof roundId === 'bigint' ? roundId.toString() : roundId);
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('round'), encodeU64(roundIdBN)],
    ORE_PROGRAM_ID,
  );
}

export function entropyVarPDA(
  boardAddress: PublicKey,
  varId: BN | number | bigint = 0,
): [PublicKey, number] {
  const varIdBN =
    varId instanceof BN ? varId : new BN(typeof varId === 'bigint' ? varId.toString() : varId);
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('var'), boardAddress.toBuffer(), encodeU64(varIdBN)],
    ENTROPY_API_PROGRAM_ID,
  );
}

/**
 * Build a Deploy instruction for the ORE program.
 *
 * Rust SDK signature:
 *   pub fn deploy(
 *     signer: Pubkey,
 *     authority: Pubkey,
 *     amount: u64,
 *     round_id: u64,
 *     squares: [bool; 25],
 *   ) -> Instruction
 */
export function createDeployInstruction(params: {
  signer: PublicKey;
  authority: PublicKey;
  amountLamports: bigint;
  roundId: number;
  squares: boolean[]; // length 25
}): TransactionInstruction {
  const { signer, authority, amountLamports, roundId, squares } = params;

  if (squares.length !== 25) {
    throw new Error('squares must have length 25');
  }

  const amountBN = new BN(amountLamports.toString());
  const roundIdBN = new BN(roundId);

  const automationAddress = automationPDA(authority)[0];
  const boardAddress = boardPDA()[0];
  const minerAddress = minerPDA(authority)[0];
  const roundAddress = roundPDA(roundIdBN)[0];
  const entropyVarAddress = entropyVarPDA(boardAddress, 0)[0];

  // Pack 25 booleans into a u32 mask (same as frontend sdk)
  let mask = 0;
  for (let i = 0; i < 25; i++) {
    if (squares[i]) {
      mask |= 1 << i;
    }
  }

  const data = new Uint8Array([
    ...DEPLOY_DISCRIMINATOR, // 1 byte
    ...encodeU64(amountBN), // 8 bytes
    ...encodeU32(mask), // 4 bytes
  ]);

  const keys = [
    // [signer, authority, automation_address, board_address, miner_address, round_address, system_program, entropy_var_address, entropy_api]
    { pubkey: signer, isSigner: true, isWritable: true },
    { pubkey: authority, isSigner: false, isWritable: true },
    { pubkey: automationAddress, isSigner: false, isWritable: true },
    { pubkey: boardAddress, isSigner: false, isWritable: true },
    { pubkey: minerAddress, isSigner: false, isWritable: true },
    { pubkey: roundAddress, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: entropyVarAddress, isSigner: false, isWritable: true },
    { pubkey: ENTROPY_API_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  return new TransactionInstruction({
    programId: ORE_PROGRAM_ID,
    keys,
    data: Buffer.from(data),
  });
}


