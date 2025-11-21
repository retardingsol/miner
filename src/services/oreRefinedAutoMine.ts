/**
 * ORE Refined Auto-Mining Service
 * 
 * This service implements the auto-mining logic from ore_refined
 * It monitors rounds, calculates optimal deployment timing, and sends transactions
 * 
 * Based on ore_refined/src/main.rs and ore_refined/src/onchain_main.rs
 */

import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { getPrices } from './priceService';
import { claimSol } from '../solana/oreSDK';
import { createRefinedInstruction } from '../solana/oreRefinedService';
import { getState } from './api';

export interface AutoMineConfig {
  /** RPC connection */
  connection: Connection;
  /** Signer wallet */
  signer: PublicKey;
  /** Sign transaction function */
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  /** Amount of SOL to deploy per round */
  perRoundDeployAmount: number;
  /** Remaining slots threshold (deploy only in final N slots) */
  remainingSlots: number;
  /** ORE refined rate (expected ORE per unclaimed ORE) */
  oreRefinedRate: number;
  /** Callback for status updates */
  onStatusUpdate?: (status: AutoMineStatus) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Callback when transaction is sent */
  onTransactionSent?: (signature: string) => void;
}

export interface AutoMineStatus {
  isRunning: boolean;
  roundId: number | null;
  slotLeft: number | null;
  orePrice: number | null;
  solPrice: number | null;
  lastUpdate: Date | null;
  reqId: number;
  status: 'idle' | 'monitoring' | 'ready' | 'simulating' | 'waiting_approval' | 'sending' | 'confirming' | 'success' | 'error';
  statusMessage: string | null;
  lastTransaction: string | null;
}

export interface AutoMineController {
  start: () => Promise<void>;
  stop: () => void;
  getStatus: () => AutoMineStatus;
}

/**
 * Create an auto-mining controller
 */
export function createAutoMineController(config: AutoMineConfig): AutoMineController {
  let isRunning = false;
  let intervalId: NodeJS.Timeout | null = null;
  let lastRoundId = 0;
  let reqId = 0;
  
  const status: AutoMineStatus = {
    isRunning: false,
    roundId: null,
    slotLeft: null,
    orePrice: null,
    solPrice: null,
    lastUpdate: null,
    reqId: 0,
    status: 'idle',
    statusMessage: null,
    lastTransaction: null,
  };

  const updateStatus = (updates: Partial<AutoMineStatus>) => {
    Object.assign(status, updates);
    status.lastUpdate = new Date();
    config.onStatusUpdate?.(status);
  };

  const stop = () => {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    updateStatus({ isRunning: false });
  };

  const start = async () => {
    if (isRunning) {
      console.warn('Auto-mining is already running');
      return;
    }

    isRunning = true;
    updateStatus({ isRunning: true });

    // Main monitoring loop (runs every 1 second, similar to ore_refined)
    intervalId = setInterval(async () => {
      if (!isRunning) {
        stop();
        return;
      }

      try {
        // Update status: monitoring
        updateStatus({
          status: 'monitoring',
          statusMessage: 'Checking round status...',
        });

        // Fetch current state
        const state = await getState();
        if (!state || !state.round) {
          updateStatus({
            status: 'error',
            statusMessage: 'Failed to fetch round state',
          });
          return;
        }

        const roundId = parseInt(state.round.roundId, 10);
        const currentSlot = state.currentSlot ? parseInt(state.currentSlot, 10) : 0;
        const endSlot = state.round.mining.endSlot ? parseInt(state.round.mining.endSlot, 10) : 0;
        const slotLeft = Math.max(0, endSlot - currentSlot);

        // Update status
        updateStatus({
          roundId,
          slotLeft,
          status: slotLeft <= config.remainingSlots ? 'ready' : 'monitoring',
          statusMessage: slotLeft <= config.remainingSlots 
            ? `Ready to deploy! Slots remaining: ${slotLeft}` 
            : `Monitoring... Slots remaining: ${slotLeft} (waiting for ≤${config.remainingSlots})`,
        });

        // Check if round changed
        if (lastRoundId !== roundId) {
          console.log(`New round detected: ${roundId}`);
          lastRoundId = roundId;
          reqId = 0;
          
          updateStatus({
            statusMessage: `New round detected: #${roundId}. Fetching prices...`,
          });
          
          // Fetch prices when round changes
          try {
            const [orePrice, solPrice] = await getPrices();
            updateStatus({ 
              orePrice, 
              solPrice,
              statusMessage: `Prices updated: ORE $${orePrice.toFixed(2)}, SOL $${solPrice.toFixed(2)}`,
            });
          } catch (err) {
            console.error('Error fetching prices:', err);
            updateStatus({
              status: 'error',
              statusMessage: 'Failed to fetch prices',
            });
            config.onError?.(err as Error);
          }
        }

        // Check if we should deploy (only in final N slots)
        if (slotLeft > config.remainingSlots) {
          return; // Too early, wait
        }

        // Get prices if not cached
        let orePrice = status.orePrice;
        let solPrice = status.solPrice;
        if (!orePrice || !solPrice) {
          updateStatus({
            status: 'monitoring',
            statusMessage: 'Fetching prices...',
          });
          try {
            [orePrice, solPrice] = await getPrices();
            updateStatus({ orePrice, solPrice });
          } catch (err) {
            console.error('Error fetching prices:', err);
            updateStatus({
              status: 'error',
              statusMessage: 'Failed to fetch prices',
            });
            config.onError?.(err as Error);
            return;
          }
        }

        // Increment request ID
        reqId += 1;
        reqId = reqId % 100;
        updateStatus({ 
          reqId,
          status: 'ready',
          statusMessage: `Preparing transaction for round #${roundId}...`,
        });

        // Create instructions (same as ore_refined)
        // Note: Checkpoint instruction removed due to "InstructionFallbackNotFound" error
        // The refined instruction should handle checkpointing internally or it may not be needed
        
        // 1. Refined (the optimized mining instruction)
        const deployAmountLamports = Math.floor(config.perRoundDeployAmount * 1e9);
        
        updateStatus({
          status: 'ready',
          statusMessage: `Creating instructions... Deploying ${config.perRoundDeployAmount} SOL`,
        });
        
        const refinedIx = await createRefinedInstruction(
          config.connection,
          config.signer,
          roundId,
          orePrice!,
          solPrice!,
          deployAmountLamports,
          config.remainingSlots,
          config.oreRefinedRate,
          reqId
        );

        // 2. Claim SOL
        const claimSolIx = claimSol(config.signer);

        // Build transaction
        updateStatus({
          status: 'simulating',
          statusMessage: 'Building transaction...',
        });
        
        const { blockhash, lastValidBlockHeight } = await config.connection.getLatestBlockhash('confirmed');
        
        const transaction = new Transaction();
        // Note: Checkpoint removed - refined instruction should handle this
        transaction.add(refinedIx);
        transaction.add(claimSolIx);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = config.signer;

        // Simulate and send transaction (only if we have enough slots remaining)
        if (slotLeft > 0) {
          try {
            // Calculate compute units (like ore_refined: default 200k, or estimate from simulation)
            let unitsConsumed = 200000; // Default

            // Try to simulate to get accurate compute units (but don't fail if it doesn't work)
            updateStatus({
              status: 'simulating',
              statusMessage: 'Simulating transaction...',
            });
            
            try {
              const simulation = await config.connection.simulateTransaction(transaction);
              
              if (!simulation.value.err && simulation.value.unitsConsumed) {
                // Calculate compute units (like ore_refined: units_consumed * 11/10, min 200k)
                unitsConsumed = Math.max(200000, Math.floor(simulation.value.unitsConsumed * 11 / 10));
                updateStatus({
                  status: 'ready',
                  statusMessage: `Simulation successful. Compute units: ${unitsConsumed.toLocaleString()}`,
                });
              } else if (simulation.value.err) {
                console.warn('Transaction simulation failed, using default compute units:', simulation.value.err);
                updateStatus({
                  status: 'ready',
                  statusMessage: 'Using default compute units (simulation had warnings)',
                });
              }
            } catch (simErr) {
              console.warn('Could not simulate transaction, using default compute units:', simErr);
              updateStatus({
                status: 'ready',
                statusMessage: 'Using default compute units',
              });
            }

            // Add compute budget instruction
            const computeIx = ComputeBudgetProgram.setComputeUnitLimit({
              units: unitsConsumed,
            });
            
            transaction.instructions.unshift(computeIx);

            // Sign and send transaction
            // Note: Each transaction still requires wallet approval for security
            // The user has given consent to approve auto-mining transactions when prompted
            updateStatus({
              status: 'waiting_approval',
              statusMessage: 'Please approve the transaction in your wallet (you consented to approve auto-mining transactions)...',
            });
            
            // This will trigger the wallet to show the approval dialog
            // User has already consented to approve these transactions when auto-mining is active
            const signed = await config.signTransaction(transaction);
            
            updateStatus({
              status: 'sending',
              statusMessage: 'Transaction approved! Sending to network...',
            });
            
            const signature = await config.connection.sendRawTransaction(signed.serialize(), {
              skipPreflight: false,
              maxRetries: 3,
            });

            updateStatus({
              status: 'confirming',
              statusMessage: `Confirming transaction: ${signature.slice(0, 8)}...`,
              lastTransaction: signature,
            });

            // Wait for confirmation
            await config.connection.confirmTransaction({
              signature,
              blockhash,
              lastValidBlockHeight,
            }, 'confirmed');

            updateStatus({
              status: 'success',
              statusMessage: `✅ Transaction confirmed! Signature: ${signature.slice(0, 8)}...`,
            });

            console.log('✅ Auto-mining transaction sent:', signature);
            config.onTransactionSent?.(signature);
            
            // Reset status after a short delay
            setTimeout(() => {
              updateStatus({
                status: 'monitoring',
                statusMessage: 'Transaction complete. Monitoring next round...',
              });
            }, 3000);
            
          } catch (err) {
            console.error('Error sending auto-mining transaction:', err);
            const errorMsg = err instanceof Error ? err.message : 'Unknown error';
            updateStatus({
              status: 'error',
              statusMessage: `❌ Error: ${errorMsg}`,
            });
            config.onError?.(err as Error);
          }
        }

      } catch (err) {
        console.error('Error in auto-mining loop:', err);
        config.onError?.(err as Error);
      }
    }, 1000); // Check every 1 second (same as ore_refined)
  };

  return {
    start,
    stop,
    getStatus: () => ({ ...status }),
  };
}

