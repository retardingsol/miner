/**
 * Utility to extract actual instruction discriminators from real on-chain transactions
 * 
 * This helps us identify the correct discriminator format by analyzing
 * actual transactions that succeeded on mainnet.
 */

import { Connection, PublicKey } from '@solana/web3.js';

const ORE_PROGRAM_ID = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

/**
 * Extract instruction discriminator from a real transaction
 * 
 * @param connection - Solana RPC connection
 * @param signature - Transaction signature to analyze
 * @param instructionIndex - Index of the instruction to extract (default: 0)
 * @returns The discriminator bytes (first 8 bytes of instruction data)
 */
export async function extractDiscriminatorFromTransaction(
  connection: Connection,
  signature: string,
  _instructionIndex: number = 0
): Promise<Uint8Array | null> {
  try {
    const transaction = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      console.error('Transaction not found');
      return null;
    }

    const message = transaction.transaction.message;
    // Handle both legacy and versioned transactions
    const instructions = 'compiledInstructions' in message 
      ? message.compiledInstructions || []
      : [];

    if (!instructions || instructions.length === 0) {
      console.error('No instructions found in transaction');
      return null;
    }

    // Find ORE program instruction
    // Use getAccountKeys() for versioned messages, or accountKeys for legacy
    const accountKeys = 'getAccountKeys' in message 
      ? message.getAccountKeys().keySegments().flat()
      : (message as any).accountKeys || [];
    const oreInstruction = instructions.find((ix: any) => {
      if (typeof ix === 'object' && 'programIdIndex' in ix) {
        const programIdIndex = ix.programIdIndex;
        const accountKey = accountKeys[programIdIndex];
        if (accountKey instanceof PublicKey) {
          return accountKey.equals(ORE_PROGRAM_ID);
        } else if (typeof accountKey === 'object' && accountKey && 'pubkey' in accountKey) {
          return accountKey.pubkey === ORE_PROGRAM_ID.toBase58();
        } else if (typeof accountKey === 'string') {
          return accountKey === ORE_PROGRAM_ID.toBase58();
        }
        return false;
      }
      return false;
    });

    if (!oreInstruction) {
      console.error('ORE program instruction not found');
      return null;
    }

    // Get instruction data
    const data = oreInstruction.data;
    if (!data || data.length < 8) {
      console.error('Instruction data too short');
      return null;
    }

    // Decode base64 if needed
    let dataBytes: Uint8Array;
    if (typeof data === 'string') {
      dataBytes = Uint8Array.from(Buffer.from(data, 'base64'));
    } else {
      dataBytes = data;
    }

    // Extract discriminator (first 8 bytes)
    const discriminator = dataBytes.slice(0, 8);

    console.log('✅ Extracted discriminator from transaction:', {
      signature,
      discriminatorHex: Buffer.from(discriminator).toString('hex'),
      discriminatorBytes: Array.from(discriminator).map(b => '0x' + b.toString(16).padStart(2, '0')).join(', '),
      fullDataHex: Buffer.from(dataBytes).toString('hex'),
      dataLength: dataBytes.length,
    });

    return discriminator;
  } catch (error) {
    console.error('Error extracting discriminator:', error);
    return null;
  }
}

/**
 * Try to find a recent Deploy transaction and extract its discriminator
 */
export async function findDeployDiscriminator(connection: Connection): Promise<Uint8Array | null> {
  try {
    // Get recent signatures for the ORE program
    const signatures = await connection.getSignaturesForAddress(ORE_PROGRAM_ID, {
      limit: 50,
    });

    console.log(`Found ${signatures.length} recent transactions`);

    // Try to find a Deploy transaction (look for transactions with 9 accounts, which is what Deploy uses)
    for (const sigInfo of signatures) {
      try {
        const discriminator = await extractDiscriminatorFromTransaction(connection, sigInfo.signature);
        if (discriminator) {
          // Check if this looks like a Deploy transaction (discriminator is not all zeros, which would be Automate)
          const isNotAutomate = !discriminator.every(b => b === 0);
          if (isNotAutomate) {
            console.log('🎯 Found potential Deploy transaction:', sigInfo.signature);
            return discriminator;
          }
        }
      } catch (err) {
        // Continue to next transaction
        continue;
      }
    }

    console.warn('Could not find Deploy transaction');
    return null;
  } catch (error) {
    console.error('Error finding Deploy discriminator:', error);
    return null;
  }
}

