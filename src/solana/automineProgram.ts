/**
 * AutoMine Manager Program Interface
 * 
 * This file defines the TypeScript types and client-side functions for interacting
 * with the AutoMine Manager Solana program. The program will manage user vaults
 * and automine configurations on-chain.
 * 
 * Program Structure:
 * - UserVault: PDA derived from [user_pubkey, "vault"]
 * - UserConfig: PDA derived from [user_pubkey, "config"]
 * 
 * Instructions:
 * 1. InitUser - Initialize user vault and config accounts
 * 2. Deposit - Deposit SOL into user vault
 * 3. Withdraw - Withdraw SOL from user vault
 * 4. UpdateConfig - Update automine configuration (max SOL per round, max total SOL, risk profile)
 * 5. ExecuteAutomine - Backend bot calls this to execute mining on behalf of user
 */

import {
  PublicKey,
  Transaction,
  SystemProgram,
} from '@solana/web3.js';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import BN from 'bn.js';

// ORE Program ID (found from analyzing transactions)
// This is the actual ORE mining program on Solana mainnet
export const ORE_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

// ORE Token Mint Address
export const ORE_MINT = new PublicKey('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp');

// Legacy AutoMine Manager Program ID (not used in Option B - direct integration)
// Kept for reference if Option A is implemented later
export const AUTOMINE_PROGRAM_ID = new PublicKey('11111111111111111111111111111111'); // Placeholder - not used

/**
 * AutoMine Configuration
 */
export interface AutoMineConfig {
  /** Maximum SOL to deploy per round (in lamports) */
  maxSolPerRound: BN;
  /** Maximum total SOL to keep in vault (in lamports) */
  maxTotalSol: BN;
  /** Risk profile: 0 = beginner, 1 = balanced, 2 = aggressive */
  riskProfile: number;
  /** EV threshold in basis points (e.g., 100 = 1% positive EV required) */
  evThresholdBps: number;
  /** Number of blocks to target (1-24) */
  numBlocks: number;
  /** Whether automine is enabled */
  enabled: boolean;
}

/**
 * User Vault Account Data
 */
export interface UserVault {
  /** Owner public key */
  owner: PublicKey;
  /** Current SOL balance in lamports */
  balance: BN;
  /** Total SOL deposited (cumulative) */
  totalDeposited: BN;
  /** Total SOL withdrawn (cumulative) */
  totalWithdrawn: BN;
}

/**
 * User Config Account Data
 */
export interface UserConfig {
  /** Owner public key */
  owner: PublicKey;
  /** AutoMine configuration */
  config: AutoMineConfig;
  /** Last round number that was mined */
  lastMinedRound: BN;
  /** Total rounds mined */
  totalRoundsMined: BN;
}

/**
 * Instruction Discriminators
 * These match the program's instruction enum variants
 */
export const AutoMineInstruction = {
  InitUser: 0,
  Deposit: 1,
  Withdraw: 2,
  UpdateConfig: 3,
  ExecuteAutomine: 4,
} as const;

/**
 * Helper to convert string to Uint8Array (browser-compatible alternative to Buffer.from)
 */
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Derive User Vault PDA
 */
export function deriveUserVaultPDA(userPubkey: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('vault'), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Derive User Config PDA
 */
export function deriveUserConfigPDA(userPubkey: PublicKey, programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [stringToUint8Array('config'), userPubkey.toBuffer()],
    programId
  );
}

/**
 * Create InitUser instruction
 * Initializes the user's vault and config accounts
 */
export function createInitUserInstruction(
  userPubkey: PublicKey,
  programId: PublicKey = AUTOMINE_PROGRAM_ID
): Transaction {
  // Derive PDAs (will be used when building actual instruction)
  deriveUserVaultPDA(userPubkey, programId);
  deriveUserConfigPDA(userPubkey, programId);

  // TODO: Build actual instruction buffer once program is deployed
  // For now, this is a placeholder structure
  const transaction = new Transaction();

  // Instruction layout:
  // discriminator (1 byte) = InitUser (0)
  // The program will create the vault and config PDAs

  return transaction;
}

/**
 * Create Deposit instruction
 * Deposits SOL from user's wallet into their vault
 */
export function createDepositInstruction(
  userPubkey: PublicKey,
  amountLamports: BN,
  programId: PublicKey = AUTOMINE_PROGRAM_ID
): Transaction {
  const [vaultPDA] = deriveUserVaultPDA(userPubkey, programId);

  const transaction = new Transaction();

  // Instruction layout:
  // discriminator (1 byte) = Deposit (1)
  // amount (8 bytes) = u64 lamports

  // Add system transfer from user to vault
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: userPubkey,
      toPubkey: vaultPDA,
      lamports: amountLamports.toNumber(),
    })
  );

  return transaction;
}

/**
 * Create Withdraw instruction
 * Withdraws SOL from user's vault to their wallet
 */
export function createWithdrawInstruction(
  userPubkey: PublicKey,
  _amountLamports: BN,
  programId: PublicKey = AUTOMINE_PROGRAM_ID
): Transaction {
  deriveUserVaultPDA(userPubkey, programId);

  const transaction = new Transaction();

  // Instruction layout:
  // discriminator (1 byte) = Withdraw (2)
  // amount (8 bytes) = u64 lamports

  return transaction;
}

/**
 * Create UpdateConfig instruction
 * Updates the user's automine configuration
 */
export function createUpdateConfigInstruction(
  userPubkey: PublicKey,
  _config: Partial<AutoMineConfig>,
  programId: PublicKey = AUTOMINE_PROGRAM_ID
): Transaction {
  deriveUserConfigPDA(userPubkey, programId);

  const transaction = new Transaction();

  // Instruction layout:
  // discriminator (1 byte) = UpdateConfig (3)
  // max_sol_per_round (8 bytes) = u64 lamports (optional, use 0 to skip)
  // max_total_sol (8 bytes) = u64 lamports (optional, use 0 to skip)
  // risk_profile (1 byte) = u8 (optional, use 255 to skip)
  // ev_threshold_bps (2 bytes) = u16 (optional, use 65535 to skip)
  // num_blocks (1 byte) = u8 (optional, use 255 to skip)
  // enabled (1 byte) = bool (optional, use 2 to skip)

  return transaction;
}

/**
 * Create ExecuteAutomine instruction
 * Called by backend bot to execute mining on behalf of user
 * This will be called with the bot's authority, not the user's
 */
export function createExecuteAutomineInstruction(
  userPubkey: PublicKey,
  _roundId: BN,
  _amountLamports: BN,
  _numBlocks: number,
  programId: PublicKey = AUTOMINE_PROGRAM_ID
): Transaction {
  deriveUserVaultPDA(userPubkey, programId);
  deriveUserConfigPDA(userPubkey, programId);

  const transaction = new Transaction();

  // Instruction layout:
  // discriminator (1 byte) = ExecuteAutomine (4)
  // round_id (8 bytes) = u64
  // amount (8 bytes) = u64 lamports
  // num_blocks (1 byte) = u8

  // This instruction will:
  // 1. Verify the caller is authorized (bot authority)
  // 2. Check config constraints (max SOL per round, max total SOL)
  // 3. Transfer SOL from vault to ORE program
  // 4. Call ORE program's claim instruction
  // 5. Update last_mined_round and total_rounds_mined

  return transaction;
}

/**
 * Client-side hook for AutoMine operations
 * Provides functions to interact with the AutoMine program
 */
export function useAutoMine() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  // Don't throw error if wallet is not connected - just return functions that will check connection
  // This allows the component to render when wallet is disconnected

  /**
   * Initialize user vault and config
   */
  const initUser = async (): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const { blockhash } = await connection.getLatestBlockhash();
      const transaction = createInitUserInstruction(publicKey);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
      }
      throw error;
    }
  };

  /**
   * Deposit SOL into vault
   */
  const deposit = async (amountSol: number): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const { blockhash } = await connection.getLatestBlockhash();
      const amountLamports = new BN(amountSol * 1e9);
      const transaction = createDepositInstruction(publicKey, amountLamports);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
      }
      throw error;
    }
  };

  /**
   * Withdraw SOL from vault
   */
  const withdraw = async (amountSol: number): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const { blockhash } = await connection.getLatestBlockhash();
      const amountLamports = new BN(amountSol * 1e9);
      const transaction = createWithdrawInstruction(publicKey, amountLamports);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
      }
      throw error;
    }
  };

  /**
   * Update automine configuration
   */
  const updateConfig = async (config: Partial<AutoMineConfig>): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const { blockhash } = await connection.getLatestBlockhash();
      const transaction = createUpdateConfigInstruction(publicKey, config);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature);

      return signature;
    } catch (error) {
      if (error instanceof Error && error.message.includes('403')) {
        throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
      }
      throw error;
    }
  };

  /**
   * Fetch user vault data
   */
  const fetchVault = async (): Promise<UserVault | null> => {
    if (!publicKey) {
      return null;
    }

    const [vaultPDA] = deriveUserVaultPDA(publicKey, AUTOMINE_PROGRAM_ID);
    
    try {
      const accountInfo = await connection.getAccountInfo(vaultPDA);
      if (!accountInfo) {
        return null;
      }

      // TODO: Deserialize account data once program is deployed
      // For now, return null
      return null;
    } catch (error) {
      console.error('Error fetching vault:', error);
      return null;
    }
  };

  /**
   * Fetch user config data
   */
  const fetchConfig = async (): Promise<UserConfig | null> => {
    if (!publicKey) {
      return null;
    }

    const [configPDA] = deriveUserConfigPDA(publicKey, AUTOMINE_PROGRAM_ID);
    
    try {
      const accountInfo = await connection.getAccountInfo(configPDA);
      if (!accountInfo) {
        return null;
      }

      // TODO: Deserialize account data once program is deployed
      // For now, return null
      return null;
    } catch (error) {
      console.error('Error fetching config:', error);
      return null;
    }
  };

  return {
    initUser,
    deposit,
    withdraw,
    updateConfig,
    fetchVault,
    fetchConfig,
    isReady: publicKey !== null,
  };
}

