/**
 * Test instruction creation for ORE Refined
 * This tests that we can create the Refined instruction correctly
 * Run with: npx tsx src/services/test-instruction-creation.ts
 */

import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { createRefinedInstruction } from '../solana/oreRefinedService';
import { checkpoint, claimSol } from '../solana/oreSDK';
import { getPrices } from './priceService';
import { getState } from './api';
import BN from 'bn.js';

async function testInstructionCreation() {
  console.log('🧪 Testing Instruction Creation...\n');

  try {
    // Test 1: Create a dummy connection and signer
    console.log('Test 1: Setup connection and signer');
    console.log('-----------------------------------');
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    const signer = Keypair.generate().publicKey;
    
    console.log(`✅ Connection: ${connection.rpcEndpoint}`);
    console.log(`✅ Signer: ${signer.toBase58()}\n`);

    // Test 2: Get current state
    console.log('Test 2: Fetch current round state');
    console.log('----------------------------------');
    const state = await getState();
    
    if (!state || !state.round) {
      throw new Error('Failed to fetch state');
    }

    const roundId = parseInt(state.round.roundId, 10);
    console.log(`✅ Round ID: ${roundId}\n`);

    // Test 3: Get prices
    console.log('Test 3: Fetch prices');
    console.log('--------------------');
    const [orePrice, solPrice] = await getPrices();
    console.log(`✅ ORE Price: $${orePrice.toFixed(4)}`);
    console.log(`✅ SOL Price: $${solPrice.toFixed(2)}\n`);

    // Test 4: Create checkpoint instruction
    console.log('Test 4: Create checkpoint instruction');
    console.log('-------------------------------------');
    try {
      const checkpointIx = checkpoint(signer, signer, new BN(roundId));
      console.log(`✅ Checkpoint instruction created`);
      console.log(`   Program ID: ${checkpointIx.programId.toBase58()}`);
      console.log(`   Data length: ${checkpointIx.data.length} bytes`);
      console.log(`   Accounts: ${checkpointIx.keys.length}\n`);
    } catch (error) {
      console.error('❌ Failed to create checkpoint instruction:', error);
      throw error;
    }

    // Test 5: Create refined instruction
    console.log('Test 5: Create refined instruction');
    console.log('----------------------------------');
    try {
      const deployAmount = 0.01; // 0.01 SOL for testing
      const deployAmountLamports = Math.floor(deployAmount * 1e9);
      
      console.log(`   Parameters:`);
      console.log(`   - Round ID: ${roundId}`);
      console.log(`   - ORE Price: $${orePrice.toFixed(4)}`);
      console.log(`   - SOL Price: $${solPrice.toFixed(2)}`);
      console.log(`   - Deploy Amount: ${deployAmount} SOL (${deployAmountLamports} lamports)`);
      console.log(`   - Remaining Slots: 15`);
      console.log(`   - ORE Refined Rate: 1.3`);
      console.log(`   - Request ID: 0\n`);

      const refinedIx = await createRefinedInstruction(
        connection,
        signer,
        roundId,
        orePrice,
        solPrice,
        deployAmountLamports,
        15, // remaining_slots
        1.3, // ore_refined_rate
        0 // req_id
      );

      console.log(`✅ Refined instruction created`);
      console.log(`   Program ID: ${refinedIx.programId.toBase58()}`);
      console.log(`   Data length: ${refinedIx.data.length} bytes`);
      console.log(`   Accounts: ${refinedIx.keys.length}`);
      console.log(`   Account list:`);
      refinedIx.keys.forEach((acc, i) => {
        console.log(`     [${i}] ${acc.pubkey.toBase58()} (signer: ${acc.isSigner}, writable: ${acc.isWritable})`);
      });
      console.log('');
    } catch (error) {
      console.error('❌ Failed to create refined instruction:', error);
      if (error instanceof Error) {
        console.error('   Error message:', error.message);
      }
      throw error;
    }

    // Test 6: Create claim SOL instruction
    console.log('Test 6: Create claim SOL instruction');
    console.log('------------------------------------');
    try {
      const claimSolIx = claimSol(signer);
      console.log(`✅ Claim SOL instruction created`);
      console.log(`   Program ID: ${claimSolIx.programId.toBase58()}`);
      console.log(`   Data length: ${claimSolIx.data.length} bytes`);
      console.log(`   Accounts: ${claimSolIx.keys.length}\n`);
    } catch (error) {
      console.error('❌ Failed to create claim SOL instruction:', error);
      throw error;
    }

    // Test 7: Test transaction structure
    console.log('Test 7: Transaction structure');
    console.log('------------------------------');
    console.log('   Transaction should contain:');
    console.log('   1. Checkpoint instruction');
    console.log('   2. Refined instruction');
    console.log('   3. Claim SOL instruction');
    console.log('   ✅ All instructions can be created\n');

    console.log('✅ All instruction creation tests passed!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Test with actual wallet connection');
    console.log('   2. Test transaction simulation');
    console.log('   3. Test actual transaction sending (with small amount)');
    console.log('   4. Monitor transaction confirmation');
    
  } catch (error) {
    console.error('❌ Instruction creation test failed:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testInstructionCreation();

