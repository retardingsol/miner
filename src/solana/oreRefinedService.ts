/**
 * ORE Refined Service
 * 
 * This service uses the ore_refined GitHub project's wrapper program
 * to create Refined instructions, exactly as instructed in the repository.
 * 
 * Program ID: HZJfY7oVkbWxsmMQX5ipqahMnC74H72UYaBXJ8an2PoR
 * This matches ore_refined's ore_por_program
 */

import { Connection, PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { BorshInstructionCoder } from '@coral-xyz/anchor';
import BN from 'bn.js';
import IDL from '../../ore_refined/idls/ore_por_program.json';
import {
  automationPDA,
  boardPDA,
  minerPDA,
  roundPDA,
} from './oreSDK';
import { ORE_PROGRAM_ID } from './oreProgram';
import { stringToUint8Array } from './oreProgram';

// Program ID from ore_refined IDL
export const ORE_POR_PROGRAM_ID = new PublicKey('HZJfY7oVkbWxsmMQX5ipqahMnC74H72UYaBXJ8an2PoR');

// Fee wallet from ore_refined
export const FEE_WALLET = new PublicKey('Feei2iwqp9Adcyte1F5XnKzGTFL1VDg4VyiypvoeiJyJ');

// ORE program ID used by ore_refined
const ORE_PROGRAM_ID_REFINED = new PublicKey('oreV3EG1i9BEgiAJ8b177Z2S2rMarzak4NMv1kULvWv');

/**
 * Create a Refined instruction using the ore_refined wrapper program
 * This matches exactly how ore_refined/src/onchain_main.rs does it
 * Uses Anchor's client to generate instruction properly
 */
export async function createRefinedInstruction(
  _connection: Connection,
  signer: PublicKey,
  roundId: BN | number,
  orePrice: number,
  solPrice: number,
  deployAmount: BN | number,
  remainingSlots: number = 15,
  oreRefinedRate: number = 1.3,
  reqId: number = 0
): Promise<TransactionInstruction> {
  const roundIdBN = BN.isBN(roundId) ? roundId : new BN(roundId);
  const deployAmountBN = BN.isBN(deployAmount) ? deployAmount : new BN(deployAmount);

  // Derive accounts exactly as ore_refined does
  const automationAddress = automationPDA(signer)[0];
  const boardAddress = boardPDA()[0];
  const minerAddress = minerPDA(signer)[0];
  const roundAddress = roundPDA(roundIdBN)[0];
  
  // Derive treasury PDA (ore_refined uses treasury_pda(), not a constant)
  // From ore_api::prelude::treasury_pda()
  const treasuryAddress = PublicKey.findProgramAddressSync(
    [stringToUint8Array('treasury')],
    ORE_PROGRAM_ID
  )[0];

  // Load and parse IDL
  const programIdl = IDL as any;
  
  // Verify IDL is loaded correctly
  if (!programIdl || !programIdl.instructions) {
    throw new Error('Failed to load IDL from ore_refined');
  }
  
  // Use manual Borsh encoding (more reliable than program.methods)

  // Use manual Borsh encoding (more reliable than program.methods)
  // The IDL shows the instruction name is "refined" with discriminator [63,24,160,231,240,209,92,51]
  try {
    const coder = new BorshInstructionCoder(programIdl);
    
    // Encode instruction data using Borsh
    // Args from IDL: ore_price (f64), sol_price (f64), amount (u64), remaining_slots (u8), ore_refined_rate (f64), req_id (u8)
    const data = coder.encode('refined', {
      ore_price: orePrice,
      sol_price: solPrice,
      amount: deployAmountBN,
      remaining_slots: remainingSlots,
      ore_refined_rate: oreRefinedRate,
      req_id: reqId,
    });
    
    if (!data) {
      throw new Error('Failed to encode Refined instruction data');
    }
    
    // Verify discriminator matches IDL
    const expectedDiscriminator = Buffer.from([63, 24, 160, 231, 240, 209, 92, 51]);
    const actualDiscriminator = data.slice(0, 8);
    if (!actualDiscriminator.equals(expectedDiscriminator)) {
      console.warn('⚠️ Discriminator mismatch. Expected:', expectedDiscriminator.toString('hex'), 'Got:', actualDiscriminator.toString('hex'));
    }
    
    // Create instruction with accounts exactly as IDL specifies
    return new TransactionInstruction({
      programId: ORE_POR_PROGRAM_ID,
      keys: [
        { pubkey: signer, isSigner: true, isWritable: true }, // signer
        { pubkey: signer, isSigner: false, isWritable: true }, // authority
        { pubkey: automationAddress, isSigner: false, isWritable: true }, // automation
        { pubkey: boardAddress, isSigner: false, isWritable: true }, // board
        { pubkey: minerAddress, isSigner: false, isWritable: true }, // miner
        { pubkey: roundAddress, isSigner: false, isWritable: true }, // round
        { pubkey: treasuryAddress, isSigner: false, isWritable: true }, // treasury
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
        { pubkey: ORE_PROGRAM_ID_REFINED, isSigner: false, isWritable: false }, // ore_program
        { pubkey: FEE_WALLET, isSigner: false, isWritable: true }, // fee
      ],
      data: data,
    });
  } catch (error: any) {
    console.error('❌ Error creating Refined instruction:', error);
    console.error('   Error details:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    throw new Error(`Failed to create Refined instruction: ${error.message}`);
  }
}

