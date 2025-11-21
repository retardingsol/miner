/**
 * Utility to test different instruction names and find the correct one
 * 
 * This can be used to brute-force test different instruction name variations
 * by trying them one by one until we find the one that works.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ORE_DISCRIMINATORS as _ORE_DISCRIMINATORS_unused } from './oreDiscriminators';

/**
 * List of potential instruction names to test
 * Based on common Anchor patterns and file names found in ORE repo
 */
export const TEST_INSTRUCTION_NAMES = [
  // Current (doesn't work)
  'automate',
  
  // Capital variations
  'Automate',
  'AUTOMATE',
  
  // With prefixes
  'initialize_automation',
  'InitializeAutomation',
  'init_automation',
  'InitAutomation',
  'create_automation',
  'CreateAutomation',
  'setup_automation',
  'SetupAutomation',
  'update_automation',
  'UpdateAutomation',
  'enable_automation',
  'EnableAutomation',
  'start_automation',
  'StartAutomation',
  'register_automation',
  'RegisterAutomation',
  
  // Simple names
  'initialize',
  'Initialize',
  'init',
  'Init',
  'setup',
  'Setup',
  'create',
  'Create',
] as const;

/**
 * Calculate discriminator for an instruction name
 * Uses Web Crypto API for browser compatibility
 */
export async function calculateDiscriminator(instructionName: string): Promise<Uint8Array> {
  const preimage = `global:${instructionName}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(preimage);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  return hashArray.slice(0, 8);
}

/**
 * Get all discriminators for test instruction names
 */
export async function getAllDiscriminators(): Promise<Map<string, string>> {
  const discriminators = new Map<string, string>();
  
  for (const name of TEST_INSTRUCTION_NAMES) {
    const disc = await calculateDiscriminator(name);
    const hex = Array.from(disc)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    discriminators.set(name, hex);
  }
  
  return discriminators;
}

/**
 * Find instruction name by discriminator (reverse lookup)
 */
export async function findInstructionNameByDiscriminator(
  targetDiscriminator: string
): Promise<string | null> {
  const discriminators = await getAllDiscriminators();
  
  for (const [name, disc] of discriminators.entries()) {
    if (disc === targetDiscriminator.toLowerCase()) {
      return name;
    }
  }
  
  return null;
}

/**
 * Log all discriminators for debugging
 */
export async function logAllDiscriminators(): Promise<void> {
  console.log('Instruction Name Discriminators:');
  console.log('='.repeat(70));
  
  const discriminators = await getAllDiscriminators();
  for (const [name, disc] of discriminators.entries()) {
    const isCurrent = name === 'automate';
    const marker = isCurrent ? ' ← CURRENT (not working)' : '';
    console.log(`${name.padEnd(30)} -> ${disc}${marker}`);
  }
}

