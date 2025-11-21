/**
 * React Hook for ORE Program Interactions
 * 
 * This hook provides functions to interact with the ORE program,
 * including automation setup and SOL claiming.
 */

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction, PublicKey, TransactionInstruction } from '@solana/web3.js';
import BN from 'bn.js';
// Use SDK functions instead of manual instruction building
import {
  automate as createAutomateInstruction,
  claimSol as createClaimSOLInstruction,
  deploy as createDeployInstruction,
  automationPDA as deriveAutomationPDA,
} from './oreSDK';

export interface AutomationConfig {
  evThresholdBps: number;
  numBlocks: number;
  maxSolPerRound: number; // in SOL
  enabled: boolean;
}

/**
 * Raw automation parameters matching ORE program structure
 */
export interface RawAutomationConfig {
  amount: BN; // u64, in lamports
  deposit: BN; // u64, in lamports
  fee: BN; // u64, in lamports
  mask: BN; // u64, block mask
  strategy: BN; // u64, strategy enum
}

export interface AutomationAccount {
  owner: PublicKey;
  evThresholdBps: number;
  numBlocks: number;
  maxSolPerRound: BN;
  enabled: boolean;
}

/**
 * Hook for ORE program operations
 */
export function useOreProgram() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  /**
   * Setup or update automation
   */
  const setupAutomation = async (config: AutomationConfig): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

        try {
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          
          // Log what we're sending for debugging
          console.log('🔍 Setting up automation with config:', {
            evThresholdBps: config.evThresholdBps,
            numBlocks: config.numBlocks,
            maxSolPerRound: config.maxSolPerRound,
            enabled: config.enabled,
          });
          
          // Convert UI parameters to ORE program parameters
          // TODO: Need to properly map evThresholdBps, numBlocks, maxSolPerRound, enabled
          // to amount, deposit, fee, mask, strategy
          // For now, using basic mapping - this needs to be verified
          const amount = new BN(config.maxSolPerRound * 1e9); // maxSolPerRound in lamports
          const deposit = new BN(0); // Initial deposit (can be 0)
          const fee = new BN(0); // Fee for executor (need to determine)
      
      // Convert numBlocks to mask (bitmask: 1 << blockIndex for each block)
      // For "all 25 blocks", mask would be (1 << 25) - 1 = 0x1FFFFFF
      let mask = new BN(0);
      if (config.numBlocks === 25) {
        // All 25 blocks: set bits 0-24
        mask = new BN(0x1FFFFFF); // (1 << 25) - 1
      } else {
        // For specific number of blocks, we'd need to know which blocks
        // For now, set first numBlocks bits
        for (let i = 0; i < config.numBlocks; i++) {
          mask = mask.or(new BN(1).shln(i));
        }
      }
      
      // Strategy: map evThresholdBps and enabled to strategy enum
      // TODO: Need to understand AutomationStrategy enum values
      // For now, using 0 as placeholder - strategy is u8 (0-255), not u64!
      const strategy = 0; // u8 - need to map evThresholdBps and enabled
      
      // Create Automate instruction
      // Executor can be user's pubkey (they execute their own automation) or Pubkey::default() to close
      // For now, use user's pubkey as executor
      const executor = publicKey;
      const instruction = createAutomateInstruction(
        publicKey,
        amount,
        deposit,
        executor,
        fee,
        mask,
        strategy // u8, not BN
      );

      // Debug: Log instruction details before building transaction
      console.log('🔍 Instruction details:', {
        programId: instruction.programId?.toBase58 ? instruction.programId.toBase58() : String(instruction.programId),
        keys: instruction.keys.map((k, i) => ({
          index: i,
          pubkey: k.pubkey?.toBase58 ? k.pubkey.toBase58() : String(k.pubkey),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        dataLength: instruction.data.length,
        dataHex: Buffer.from(instruction.data).toString('hex'),
      });

      // Build transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return signature;
    } catch (error) {
      // Enhanced error handling for devnet testing
      if (error instanceof Error) {
        if (error.message.includes('403')) {
          throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
        }
        // Parse transaction errors for better debugging
        if (error.message.includes('custom program error')) {
          const errorMatch = error.message.match(/custom program error: (0x[0-9a-f]+|\d+)/i);
          if (errorMatch) {
            throw new Error(`Transaction failed: ${error.message}\n\nThis might indicate:\n- Wrong account order\n- Invalid PDA derivation\n- Missing required account\n\nProgram error code: ${errorMatch[1]}`);
          }
        }
        if (error.message.includes('Account') && error.message.includes('invalid')) {
          throw new Error(`Invalid account: ${error.message}\n\nThis might indicate:\n- Wrong PDA derivation\n- Account not found\n- Account order mismatch`);
        }
      }
      throw error;
    }
  };

  /**
   * Deploy (mine) on squares
   * Based on ORE API SDK: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
   * 
   * @param amount - Amount of SOL to deploy in lamports
   * @param roundId - Current round ID (as BN or number)
   * @param squares - Array of 25 booleans representing which squares to bet on (index 0-24)
   * @returns Transaction signature
   */
  const deploy = async (
    amount: BN,
    roundId: BN | number,
    squares: boolean[] // Array of 25 booleans
  ): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    if (squares.length !== 25) {
      throw new Error('Squares array must have exactly 25 elements');
    }

    // Convert roundId to BN if needed
    const roundIdBN = BN.isBN(roundId) ? roundId : new BN(roundId);
    
    // Create Deploy instruction (before try so it's available in catch)
    let instruction: TransactionInstruction | null = null;
    
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Create Deploy instruction
      instruction = createDeployInstruction(
        publicKey, // signer
        publicKey, // authority (usually same as signer)
        amount, // amount in lamports
        roundIdBN, // round ID
        squares // array of 25 booleans
      );

      // Debug: Log instruction details
      console.log('🔍 Deploy instruction details:', {
        programId: instruction.programId?.toBase58 ? instruction.programId.toBase58() : String(instruction.programId),
        keys: instruction.keys.map((k: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }, i: number) => ({
          index: i,
          pubkey: k.pubkey?.toBase58 ? k.pubkey.toBase58() : String(k.pubkey),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        dataLength: instruction.data.length,
        dataHex: Buffer.from(instruction.data).toString('hex'),
      });

      // Build transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Try to simulate first to get better error messages
      console.log('🧪 Simulating transaction...');
      try {
        const simulation = await connection.simulateTransaction(transaction);
        
        if (simulation.value.err) {
          console.error('❌ Simulation failed:', simulation.value.err);
          console.log('📊 Simulation logs:');
          if (simulation.value.logs) {
            simulation.value.logs.forEach((log, i) => {
              console.log(`  [${i}] ${log}`);
            });
          }
          
          // Parse simulation error
          const err = simulation.value.err;
          let errorMessage = 'Transaction simulation failed:\n\n';
          
          if (err && typeof err === 'object') {
            if ('InstructionError' in err) {
              const [index, instructionErr] = err.InstructionError as [number, any];
              errorMessage += `Instruction ${index} failed:\n`;
              
              if (typeof instructionErr === 'object') {
                if ('Custom' in instructionErr) {
                  const customCode = instructionErr.Custom;
                  errorMessage += `  Error Code: ${customCode} (0x${customCode.toString(16)})\n`;
                  errorMessage += `  Error: InstructionFallbackNotFound (101)\n`;
                  errorMessage += `  This means the discriminator is wrong!\n\n`;
                  if (instruction) {
                    errorMessage += `📋 What we sent:\n`;
                    errorMessage += `  Discriminator: 0x${instruction.data[0]?.toString(16).padStart(2, '0') || '??'} (1 byte - based on real Reset=0x09 transaction)\n`;
                    errorMessage += `  Full data: ${Buffer.from(instruction.data).toString('hex')}\n`;
                    errorMessage += `  Data length: ${instruction.data.length} bytes\n\n`;
                  }
                  errorMessage += `🔍 Note: Based on real transaction, Steel uses 1-byte enum discriminant\n`;
                  errorMessage += `  Reset = 0x09 (confirmed), Deploy should be 0x06\n`;
                  errorMessage += `  If this still fails, account order or PDA derivation might be wrong\n`;
                } else {
                  errorMessage += `  Error: ${JSON.stringify(instructionErr, null, 2)}\n`;
                }
              } else {
                errorMessage += `  Error: ${instructionErr}\n`;
              }
            } else {
              errorMessage += `Error: ${JSON.stringify(err, null, 2)}\n`;
            }
          } else {
            errorMessage += `Error: ${err}\n`;
          }
          
          throw new Error(errorMessage);
        } else {
          console.log('✅ Simulation successful!');
          console.log('  Compute units used:', simulation.value.unitsConsumed);
          console.log('  Logs:', simulation.value.logs?.length || 0);
        }
      } catch (simError: any) {
        // If simulation error has details, throw it
        if (simError instanceof Error && simError.message.includes('simulation failed')) {
          throw simError;
        }
        // Otherwise, log it but continue to actual send
        console.warn('⚠️ Simulation check failed, proceeding anyway:', simError);
      }

      // Sign and send
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return signature;
    } catch (error: any) {
      // Enhanced error handling with detailed debugging
      console.error('❌ Transaction Error:', error);
      
      if (error?.logs) {
        console.error('📋 Error Logs:');
        error.logs.forEach((log: string, i: number) => {
          console.error(`  [${i}] ${log}`);
        });
      }
      
      if (error instanceof Error) {
        if (error.message.includes('403')) {
          throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
        }
        
        // Parse transaction errors for better debugging
        if (error.message.includes('custom program error') || error.message.includes('0x65') || error.message.includes('101')) {
          const errorMatch = error.message.match(/custom program error: (0x[0-9a-f]+|\d+)/i) || 
                            error.message.match(/0x([0-9a-f]+)/i) ||
                            error.message.match(/(\d+)/);
          
          if (errorMatch) {
            const code = errorMatch[1];
            const codeNum = code.startsWith('0x') ? parseInt(code, 16) : parseInt(code, 10);
            
            let detailedError = `❌ Transaction failed with error 0x${codeNum.toString(16)} (${codeNum})\n\n`;
            detailedError += `🔍 Error Details:\n`;
            detailedError += `  Code: ${codeNum} (0x${codeNum.toString(16)})\n`;
            detailedError += `  Name: InstructionFallbackNotFound\n`;
            detailedError += `  Meaning: The instruction discriminator is wrong!\n\n`;
            
            if (instruction) {
              detailedError += `📋 What we're sending:\n`;
              const programIdStr = instruction.programId?.toBase58 ? instruction.programId.toBase58() : String(instruction.programId);
              detailedError += `  Program ID: ${programIdStr}\n`;
              detailedError += `  Data length: ${instruction.data.length} bytes\n`;
              detailedError += `  Discriminator: 0x${instruction.data[0]?.toString(16).padStart(2, '0') || '??'} (1 byte - based on real Reset=0x09 transaction)\n`;
              detailedError += `  Full data (hex): ${Buffer.from(instruction.data).toString('hex')}\n`;
              detailedError += `  Account count: ${instruction.keys.length}\n`;
              detailedError += `  Accounts:\n`;
              instruction.keys.forEach((key: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }, i: number) => {
                const pubkeyStr = key.pubkey?.toBase58 ? key.pubkey.toBase58() : String(key.pubkey);
                detailedError += `    [${i}] ${pubkeyStr} signer=${key.isSigner} writable=${key.isWritable}\n`;
              });
              detailedError += `\n`;
            } else {
              detailedError += `📋 Instruction was not created (error occurred earlier)\n\n`;
            }
            
            detailedError += `💡 Next steps:\n`;
            detailedError += `  1. Discriminator is now 1-byte (0x${instruction?.data[0]?.toString(16).padStart(2, '0') || '??'}) based on real Reset=0x09 transaction\n`;
            detailedError += `  2. If error persists, verify account order matches SDK.rs exactly\n`;
            detailedError += `  3. Check PDA derivations are correct (especially entropy_var PDA)\n`;
            detailedError += `  4. Verify all account writability flags match SDK.rs\n`;
            detailedError += `  5. Check Entropy API program ID is correct (3jSkUuYBoJzQPMEzTvkDFXCZUBksPamrVhrnHR9igu2X)\n`;
            
            throw new Error(detailedError);
          }
        }
        
        if (error.message.includes('Account') && error.message.includes('invalid')) {
          throw new Error(`Invalid account: ${error.message}\n\nThis might indicate:\n- Wrong PDA derivation\n- Account not found\n- Account order mismatch`);
        }
      }
      
      throw error;
    }
  };

  /**
   * Claim SOL rewards
   * Based on ORE API SDK: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/sdk.rs
   * SDK function: pub fn claim_sol(signer: Pubkey) -> Instruction
   * Note: No round_id needed - the miner PDA is derived from signer only
   */
  const claimSOL = async (): Promise<string> => {
    if (!publicKey || !signTransaction) {
      throw new Error('Wallet not connected');
    }

    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Create ClaimSOL instruction
      const instruction = createClaimSOLInstruction(publicKey);

      // Build transaction
      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      // Sign and send
      const signed = await signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Confirm transaction
      await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      return signature;
    } catch (error) {
      // Enhanced error handling for devnet testing
      if (error instanceof Error) {
        if (error.message.includes('403')) {
          throw new Error('RPC endpoint rate limited. Please configure a custom RPC endpoint via VITE_SOLANA_RPC_URL environment variable.');
        }
        // Parse transaction errors for better debugging
        if (error.message.includes('custom program error')) {
          const errorMatch = error.message.match(/custom program error: (0x[0-9a-f]+|\d+)/i);
          if (errorMatch) {
            throw new Error(`Transaction failed: ${error.message}\n\nThis might indicate:\n- Wrong account order\n- Invalid PDA derivation\n- Missing required account\n\nProgram error code: ${errorMatch[1]}`);
          }
        }
        if (error.message.includes('Account') && error.message.includes('invalid')) {
          throw new Error(`Invalid account: ${error.message}\n\nThis might indicate:\n- Wrong PDA derivation\n- Account not found\n- Account order mismatch`);
        }
      }
      throw error;
    }
  };

  /**
   * Fetch automation account data
   */
  const fetchAutomation = async (): Promise<AutomationAccount | null> => {
    if (!publicKey) {
      return null;
    }

    try {
      const [automationPDA] = deriveAutomationPDA(publicKey);
      const accountInfo = await connection.getAccountInfo(automationPDA);
      
      if (!accountInfo || !accountInfo.data) {
        return null;
      }

      // TODO: Deserialize account data once we understand the Automation account structure
      // For now, return null to indicate account doesn't exist or we can't parse it
      // Account data layout needs to be determined from ORE program source
      
      return null;
    } catch (error) {
      console.error('Error fetching automation account:', error);
      return null;
    }
  };

  return {
    setupAutomation,
    deploy,
    claimSOL,
    fetchAutomation,
    isReady: publicKey !== null && connection !== null,
  };
}

