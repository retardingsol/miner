/**
 * Test utility to find the correct instruction discriminator
 * 
 * This will help us identify the correct instruction name
 * by trying different variations and checking against the ORE program
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ORE_DISCRIMINATORS as _ORE_DISCRIMINATORS_unused } from './oreDiscriminators';

/**
 * List of potential instruction names to try
 * Based on common Anchor patterns and file names
 */
export const POTENTIAL_INSTRUCTIONS = [
  'automate',
  'Automate',
  'initialize_automation',
  'InitializeAutomation',
  'update_automation',
  'UpdateAutomation',
  'set_automation',
  'SetAutomation',
  'create_automation',
  'CreateAutomation',
  'init_automation',
  'InitAutomation',
] as const;

/**
 * Calculate discriminator for a given instruction name
 */
export function calculateDiscriminator(instructionName: string): Uint8Array {
  // In browser, we'd need to use Web Crypto API instead of Node.js crypto
  // For now, we'll use the known discriminator calculation
  const crypto = require('crypto');
  const preimage = `global:${instructionName}`;
  const hash = crypto.createHash('sha256').update(preimage).digest();
  return new Uint8Array(hash.slice(0, 8));
}

/**
 * Compare discriminator with known values
 */
export function compareDiscriminators(disc1: Uint8Array, disc2: Uint8Array): boolean {
  if (disc1.length !== disc2.length) return false;
  for (let i = 0; i < disc1.length; i++) {
    if (disc1[i] !== disc2[i]) return false;
  }
  return true;
}

/**
 * Error code 0x65 = 101 = InstructionFallbackNotFound
 * This means the instruction discriminator doesn't match any known instruction
 * 
 * Solutions:
 * 1. Verify the instruction name matches the Rust function name exactly
 * 2. Check if the ORE program on devnet is the same as mainnet
 * 3. Try to find the actual instruction name from the ORE program source or IDL
 */
export const INSTRUCTION_ERROR_CODES = {
  0x65: 'InstructionFallbackNotFound - Instruction discriminator not recognized',
  0x1: 'InvalidAccount - Wrong account provided',
  0x2: 'MissingAccount - Required account not provided',
  0x3: 'ConstraintViolation - Account constraint violation',
} as const;

