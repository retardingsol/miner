/**
 * ORE Mining Service
 * 
 * This service provides automated ORE mining functionality,
 * handling rounds, deployments, and reward claiming.
 * Based on ORE mining patterns and best practices.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  SendTransactionError,
} from '@solana/web3.js';
import BN from 'bn.js';
import {
  automate,
  checkpoint,
  claimSol,
  automationPDA,
  minerPDA,
  roundPDA,
  boardPDA,
} from '../solana/oreSDK';
import { createRefinedInstruction } from '../solana/oreRefinedService';

// Donation wallet used as fee wallet
const DONATION_WALLET = new PublicKey('3copeQ922WcSc5uqZbESgZ3TrfnEA8UEGHJ4EvkPAtHS');

export interface MiningConfig {
  /** Amount to bet per block in lamports */
  amountPerBlock: BN | number;
  /** Blocks to bet on (squares) - array of 25 booleans or mask */
  blocks: boolean[] | number; // boolean[] for specific blocks, or number for mask
  /** Total upfront deposit in lamports (amount of SOL to fund the whole session) */
  deposit?: BN | number;
  /** Fee to pay to executor in lamports (optional, defaults to 0 or uses donation wallet as executor) */
  fee?: BN | number;
  /** Executor public key (optional, defaults to donation wallet if fee > 0, otherwise self) */
  executor?: PublicKey;
  /** Use donation wallet as executor (default: false) */
  useDonationWallet?: boolean;
}

export interface RoundInfo {
  roundId: BN | number;
  isActive: boolean;
  canDeploy: boolean;
}

/**
 * Get current round ID from the API (more reliable than reading board account)
 */
export async function getCurrentRound(
  connection: Connection
): Promise<RoundInfo> {
  try {
    // Try to get round ID from API first (more reliable)
    try {
      const response = await fetch('https://ore-api.gmore.fun/v2/state');
      if (response.ok) {
        const data = await response.json();
        if (data.round?.roundId) {
          const roundIdNum = parseInt(data.round.roundId, 10);
          const roundIdBN = new BN(roundIdNum);

          // Ensure the round account actually exists on-chain. The API can
          // sometimes report a "future" round that has not been created yet,
          // which would cause checkpoint() to fail with
          // "Provided seeds do not result in a valid address".
          const existsOnChain = await checkRoundStatus(connection, roundIdBN);
          if (existsOnChain) {
            return {
              roundId: roundIdBN,
              isActive: true,
              canDeploy: true,
            };
          }

          console.warn(
            'API roundId does not yet exist on-chain, falling back to board account round:',
            data.round.roundId,
          );
        }
      }
    } catch (apiError) {
      console.warn('Failed to get round from API, trying board account:', apiError);
    }
    
    // Fallback: Try to read from board account
    const boardAddress = boardPDA()[0];
    const boardAccount = await connection.getAccountInfo(boardAddress);
    
    if (!boardAccount) {
      // If board account doesn't exist, return a default round ID (0)
      // This allows deployment to proceed even if we can't determine the exact round
      console.warn('Board account not found, using default round ID 0');
      return {
        roundId: new BN(0),
        isActive: true,
        canDeploy: true,
      };
    }
    
    // Parse board account to get current round ID
    // Board account structure: round_id: u64 (first 8 bytes)
    const roundIdBytes = boardAccount.data.slice(0, 8);
    const roundId = new BN(roundIdBytes, 'le'); // Little-endian
    
    return {
      roundId,
      isActive: true,
      canDeploy: true,
    };
  } catch (error) {
    console.error('Error getting current round:', error);
    // Return default round ID instead of throwing
    return {
      roundId: new BN(0),
      isActive: true,
      canDeploy: true,
    };
  }
}

/**
 * Check if a round exists and is active
 */
export async function checkRoundStatus(
  connection: Connection,
  roundId: BN | number
): Promise<boolean> {
  try {
    const roundAddress = roundPDA(roundId)[0];
    const roundAccount = await connection.getAccountInfo(roundAddress);
    return roundAccount !== null;
  } catch (error) {
    console.error('Error checking round status:', error);
    return false;
  }
}

/**
 * Setup automation for mining
 */
export async function setupMiningAutomation(
  connection: Connection,
  signer: PublicKey,
  config: MiningConfig,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Convert blocks to mask
    let mask: BN;
    if (Array.isArray(config.blocks)) {
      // Convert boolean array to mask
      mask = new BN(0);
      for (let i = 0; i < 25; i++) {
        if (config.blocks[i]) {
          mask = mask.or(new BN(1).shln(i));
        }
      }
    } else {
      // Already a mask number
      mask = new BN(config.blocks);
    }
    
    const amount = BN.isBN(config.amountPerBlock)
      ? config.amountPerBlock
      : new BN(config.amountPerBlock);

    // Upfront deposit that funds the entire auto-mining session.
    // If not provided, defaults to 0 (no additional funds moved into automation PDA).
    const deposit = config.deposit !== undefined
      ? (BN.isBN(config.deposit) ? config.deposit : new BN(config.deposit))
      : new BN(0);
    
    // Determine executor and fee
    // If using donation wallet or fee is specified, use donation wallet as executor
    const feeBN = config.fee 
      ? (BN.isBN(config.fee) ? config.fee : new BN(config.fee))
      : new BN(0);
    const useDonationWallet = config.useDonationWallet ?? (config.fee !== undefined && feeBN.toNumber() > 0);
    const executor = config.executor || (useDonationWallet ? DONATION_WALLET : signer);
    const fee = feeBN; // Default no fee
    
    console.log('💰 Mining setup:', {
      executor: executor.toBase58(),
      fee: fee.toString(),
      useDonationWallet,
    });
    
    // Create automate instruction – no checkpoint in this transaction.
    const automateInstruction = automate(
      signer,
      amount,
      deposit,
      executor,
      fee,
      mask,
      0 // Strategy: 0 = default
    );
    
    // Build transaction
    const transaction = new Transaction();
    transaction.add(automateInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer;
    
    // Sign and send
    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    // Confirm
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    console.log('✅ Automation setup complete:', signature);
    return signature;
  } catch (error) {
    // Surface rich logs for debugging, especially InstructionFallbackNotFound
    if (error instanceof SendTransactionError) {
      try {
        const logs = await error.getLogs(connection);
        console.error('Error setting up automation (SendTransactionError):', {
          message: error.message,
          logs,
        });
      } catch (logErr) {
        console.error('Error setting up automation (SendTransactionError). Failed to fetch logs:', error, logErr);
      }
    } else {
    console.error('Error setting up automation:', error);
    }
    throw error;
  }
}

/**
 * Stop / close an existing automation for the signer.
 * This sends an Automate instruction with executor = Pubkey::default(),
 * which triggers the close branch in the on-chain program.
 */
export async function stopMiningAutomation(
  connection: Connection,
  signer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

    // All-zero executor pubkey (Pubkey::default() on-chain)
    const zeroExecutorBytes = new Uint8Array(32);
    const zeroExecutor = new PublicKey(zeroExecutorBytes);

    const amount = new BN(0);
    const deposit = new BN(0);
    const fee = new BN(0);
    const mask = new BN(0);
    const strategy = 0; // default

    const automateInstruction = automate(
      signer,
      amount,
      deposit,
      zeroExecutor,
      fee,
      mask,
      strategy
    );

    const transaction = new Transaction();
    transaction.add(automateInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer;

    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );

    console.log('✅ Automation stop/close complete:', signature);
    return signature;
  } catch (error) {
    if (error instanceof SendTransactionError) {
      try {
        const logs = await error.getLogs(connection);
        console.error('Error stopping automation (SendTransactionError):', {
          message: error.message,
          logs,
        });
      } catch (logErr) {
        console.error(
          'Error stopping automation (SendTransactionError). Failed to fetch logs:',
          error,
          logErr
        );
      }
    } else {
      console.error('Error stopping automation:', error);
    }
    throw error;
  }
}

/**
 * Deploy on a round (place bets)
 */
export async function deployOnRound(
  connection: Connection,
  signer: PublicKey,
  authority: PublicKey,
  roundId: BN | number,
  amount: BN | number,
  _squares: boolean[],
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Verify miner account exists (may need to be initialized)
    const minerAddress = minerPDA(authority)[0];
    const minerAccount = await connection.getAccountInfo(minerAddress);
    
    if (!minerAccount) {
      console.warn('⚠️ Miner account does not exist - deployment may fail or create it');
    }
    
    // Use ore_refined wrapper program's Refined instruction (exactly as instructed)
    // Get prices from Jupiter API (same as ore_refined does)
    let orePrice = 0;
    let solPrice = 0;
    try {
      const priceResponse = await fetch(
        'https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSycp'
      );
      const prices = await priceResponse.json();
      orePrice = prices['oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSycp']?.usdPrice || 0;
      solPrice = prices['So11111111111111111111111111111111111111112']?.usdPrice || 0;
    } catch (error) {
      console.warn('Failed to fetch prices, using defaults:', error);
      orePrice = 1;
      solPrice = 100;
    }
    
    // Follow ore_refined pattern: checkpoint, then refined, then claim_sol
    // Create checkpoint instruction (called before refined in ore_refined)
    const checkpointInstruction = checkpoint(
      signer,
      authority,
      roundId
    );
    
    // Create refined instruction using ore_refined wrapper program (exactly as instructed)
    const refinedInstruction = await createRefinedInstruction(
      connection,
      signer,
      roundId,
      orePrice,
      solPrice,
      amount, // deployAmount in lamports
      15, // remaining_slots (default from ore_refined)
      1.3, // ore_refined_rate (default from ore_refined)
      0 // req_id
    );
    
    // Create claim_sol instruction (called after refined in ore_refined)
    const claimSolInstruction = claimSol(signer);
    
    // Build transaction with checkpoint + refined + claim_sol (matching ore_refined pattern exactly)
    const transaction = new Transaction();
    transaction.add(checkpointInstruction);
    transaction.add(refinedInstruction);
    transaction.add(claimSolInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer;
    
    // Simulate first to get better error messages
    try {
      console.log('🔍 Refined instruction details (from ore_refined):');
      console.log('  Program ID:', refinedInstruction.programId.toBase58());
      console.log('  Data length:', refinedInstruction.data.length);
      console.log('  Data hex:', Buffer.from(refinedInstruction.data).toString('hex'));
      console.log('  Data bytes:', Array.from(refinedInstruction.data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      console.log('  Accounts:', refinedInstruction.keys.map((k, i) => 
        `[${i}] ${k.pubkey.toBase58()} signer=${k.isSigner} writable=${k.isWritable}`
      ));
      
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error('❌ Simulation failed:', simulation.value.err);
        console.log('📊 Simulation logs:', simulation.value.logs);
        
        // Check if it's a discriminator error
        const errStr = JSON.stringify(simulation.value.err);
        if (errStr.includes('0x65') || errStr.includes('101') || errStr.includes('InstructionFallbackNotFound')) {
          // Log detailed instruction info for debugging
          const detailedError = new Error(
            'Instruction format error (0x65). The Refined instruction from ore_refined may be incorrect.\n\n' +
            'Instruction Details:\n' +
            `  Program ID: ${refinedInstruction.programId.toBase58()}\n` +
            `  Discriminator: ${Array.from(refinedInstruction.data.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ')}\n` +
            `  Data length: ${refinedInstruction.data.length} bytes\n` +
            `  Full data: ${Buffer.from(refinedInstruction.data).toString('hex')}\n` +
            `  Account count: ${refinedInstruction.keys.length} (expected 10)\n\n` +
            'This uses the ore_refined wrapper program (ore_por_program) as instructed.'
          );
          throw detailedError;
        }
        throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }
      console.log('✅ Simulation successful');
    } catch (simError: any) {
      // If simulation error has details, throw it
      if (simError instanceof Error && (simError.message.includes('simulation failed') || simError.message.includes('0x65'))) {
        throw simError;
      }
      console.warn('⚠️ Simulation check failed, proceeding anyway:', simError);
    }
    
    // Sign and send
    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    // Confirm
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    console.log('✅ Deployment complete:', signature);
    return signature;
  } catch (error) {
    console.error('Error deploying on round:', error);
    throw error;
  }
}

/**
 * Claim SOL rewards
 */
export async function claimRewards(
  connection: Connection,
  signer: PublicKey,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  try {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    
    // Create claim SOL instruction
    const claimInstruction = claimSol(signer);
    
    // Build transaction
    const transaction = new Transaction();
    transaction.add(claimInstruction);
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = signer;
    
    // Sign and send
    const signed = await signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    
    // Confirm
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    console.log('✅ Rewards claimed:', signature);
    return signature;
  } catch (error) {
    console.error('Error claiming rewards:', error);
    throw error;
  }
}

/**
 * Get miner balance (SOL available to claim)
 */
export async function getMinerBalance(
  connection: Connection,
  authority: PublicKey
): Promise<BN> {
  try {
    const minerAddress = minerPDA(authority)[0];
    const minerAccount = await connection.getAccountInfo(minerAddress);
    
    if (!minerAccount) {
      return new BN(0);
    }
    
    const data = minerAccount.data;
    if (data.length < 536) {
      console.warn('Miner account data too short to parse rewards_sol:', data.length);
      return new BN(0);
    }

    let offset = 8; // skip discriminator
    offset += 32; // authority
    offset += 25 * 8; // deployed[25]
    offset += 25 * 8; // cumulative[25]
    offset += 8; // checkpoint_fee
    offset += 8; // checkpoint_id
    offset += 8; // last_claim_ore_at
    offset += 8; // last_claim_sol_at
    offset += 16; // rewards_factor (Numeric)

    // rewards_sol: u64
    const rewardsSol = new BN(data.slice(offset, offset + 8), 'le');
    return rewardsSol;
  } catch (error) {
    console.error('Error getting miner balance:', error);
    return new BN(0);
  }
}

export interface MinerOreRewards {
  rewardsOre: BN;
  refinedOre: BN;
  lifetimeRewardsOre: BN;
}

/**
 * Read ORE rewards directly from the on-chain Miner account using the IDL layout.
 */
export async function getMinerOreRewards(
  connection: Connection,
  authority: PublicKey
): Promise<MinerOreRewards | null> {
  try {
    const minerAddress = minerPDA(authority)[0];
    const minerAccount = await connection.getAccountInfo(minerAddress);

    if (!minerAccount) {
      return null;
    }

    const data = minerAccount.data;
    // Minimum expected size for Miner account based on IDL fields
    if (data.length < 536) {
      console.warn('Miner account data too short to parse rewards:', data.length);
      return null;
    }

    let offset = 8; // skip 8-byte account discriminator
    offset += 32; // authority: publicKey
    offset += 25 * 8; // deployed: [u64; 25]
    offset += 25 * 8; // cumulative: [u64; 25]
    offset += 8; // checkpoint_fee: u64
    offset += 8; // checkpoint_id: u64
    offset += 8; // last_claim_ore_at: i64
    offset += 8; // last_claim_sol_at: i64
    offset += 16; // rewards_factor: Numeric (16 bytes)

    // rewards_sol: u64 (ignored here)
    offset += 8;

    const rewardsOre = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    const refinedOre = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;

    // round_id: u64
    offset += 8;
    // lifetime_rewards_sol: u64
    offset += 8;

    const lifetimeRewardsOre = new BN(data.slice(offset, offset + 8), 'le');

    return { rewardsOre, refinedOre, lifetimeRewardsOre };
  } catch (error) {
    console.error('Error reading miner ORE rewards:', error);
    return null;
  }
}

/**
 * Get automation account info
 */
export async function getAutomationInfo(
  connection: Connection,
  authority: PublicKey
): Promise<{
  exists: boolean;
  amount: BN;
  deposit: BN;
  fee: BN;
  mask: BN;
  strategy: number;
} | null> {
  try {
    const automationAddress = automationPDA(authority)[0];
    const automationAccount = await connection.getAccountInfo(automationAddress);
    
    if (!automationAccount) {
      return null;
    }
    const data = automationAccount.data;

    // Parse automation account data according to IDL:
    // struct Automation {
    //   amount: u64,
    //   authority: Pubkey,
    //   balance: u64,
    //   executor: Pubkey,
    //   fee: u64,
    //   strategy: u64,
    //   mask: u64,
    // }
    let offset = 8; // Skip 8-byte discriminator
    const amount = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    // authority pubkey (not needed here)
    offset += 32;
    const balance = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    // executor pubkey (not needed here)
    offset += 32;
    const fee = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    const strategyBN = new BN(data.slice(offset, offset + 8), 'le');
    offset += 8;
    const mask = new BN(data.slice(offset, offset + 8), 'le');

    const deposit = balance;
    const strategy = strategyBN.toNumber();

    return {
      exists: true,
      amount,
      deposit,
      fee,
      mask,
      strategy,
    };
  } catch (error) {
    console.error('Error getting automation info:', error);
    return null;
  }
}

/**
 * Automated mining function - deploys on current round
 * Uses donation wallet as fee recipient if executor is set
 */
export async function autoMineRound(
  connection: Connection,
  signer: PublicKey,
  authority: PublicKey,
  amount: BN | number,
  squares: boolean[],
  signTransaction: (tx: Transaction) => Promise<Transaction>,
  _useFeeWallet: boolean = false
): Promise<string> {
  try {
    // Get current round
    const roundInfo = await getCurrentRound(connection);
    
    // Calculate total amount (amount per block * number of blocks)
    const blocksToBet = squares.filter(Boolean).length;
    const amountPerBlock = BN.isBN(amount) ? amount : new BN(amount);
    const totalAmount = amountPerBlock.mul(new BN(blocksToBet));
    
    // Deploy on current round
    // If using fee wallet, we'd need to modify the deploy instruction
    // For now, deploy normally - fee handling is done at automation level
    return await deployOnRound(
      connection,
      signer,
      authority,
      roundInfo.roundId,
      totalAmount,
      squares,
      signTransaction
    );
  } catch (error) {
    console.error('Error in auto mining:', error);
    throw error;
  }
}

/**
 * Calculate total cost for a mining strategy
 */
export function calculateMiningCost(
  amountPerBlock: BN | number,
  blocks: boolean[]
): BN {
  const blocksCount = blocks.filter(Boolean).length;
  const amount = BN.isBN(amountPerBlock) ? amountPerBlock : new BN(amountPerBlock);
  return amount.mul(new BN(blocksCount));
}

/**
 * Convert mask number to boolean array
 */
export function maskToBlocks(mask: BN | number): boolean[] {
  const maskBN = BN.isBN(mask) ? mask : new BN(mask);
  const blocks: boolean[] = [];
  for (let i = 0; i < 25; i++) {
    blocks[i] = maskBN.testn(i);
  }
  return blocks;
}

/**
 * Convert boolean array to mask number
 */
export function blocksToMask(blocks: boolean[]): BN {
  let mask = new BN(0);
  for (let i = 0; i < 25; i++) {
    if (blocks[i]) {
      mask = mask.or(new BN(1).shln(i));
    }
  }
  return mask;
}

/**
 * Helper: Get all 25 blocks mask (bet on all squares)
 */
export function getAllBlocksMask(): boolean[] {
  return Array(25).fill(true);
}

/**
 * Helper: Get mask number for all 25 blocks
 */
export function getAllBlocksMaskNumber(): BN {
  // (1 << 25) - 1 = 0x1FFFFFF
  return new BN(0x1FFFFFF);
}

/**
 * Helper: Setup mining with all 25 blocks and donation wallet as executor
 */
export async function setupAllBlocksMining(
  connection: Connection,
  signer: PublicKey,
  amountPerBlock: BN | number,
  fee: BN | number = new BN(0),
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  return setupMiningAutomation(
    connection,
    signer,
    {
      amountPerBlock,
      blocks: getAllBlocksMask(),
      fee,
      useDonationWallet: BN.isBN(fee) ? fee.toNumber() > 0 : fee > 0, // Use donation wallet if fee is set
    },
    signTransaction
  );
}

/**
 * Helper: Deploy on all 25 blocks for current round
 */
export async function deployAllBlocks(
  connection: Connection,
  signer: PublicKey,
  authority: PublicKey,
  amountPerBlock: BN | number,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {
  const roundInfo = await getCurrentRound(connection);
  const amount = BN.isBN(amountPerBlock) ? amountPerBlock : new BN(amountPerBlock);
  const totalAmount = amount.mul(new BN(25)); // All 25 blocks
  
  return deployOnRound(
    connection,
    signer,
    authority,
    roundInfo.roundId,
    totalAmount,
    getAllBlocksMask(),
    signTransaction
  );
}

