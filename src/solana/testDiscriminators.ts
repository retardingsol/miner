/**
 * Test script to try different discriminator formats
 * 
 * This will help us find the correct discriminator format that Steel's
 * instruction! macro generates.
 */

import { Buffer } from 'buffer';
import crypto from 'crypto';

// Helper to calculate SHA256
function sha256(data: string): Buffer {
  return Buffer.from(crypto.createHash('sha256').update(data).digest());
}

// All possible discriminator formats to try
const DISCRIMINATOR_FORMATS = [
  { name: 'global:Automate', desc: 'Standard Anchor format' },
  { name: 'Automate', desc: 'Without global: prefix (current attempt)' },
  { name: 'OreInstruction::Automate', desc: 'With enum path' },
  { name: 'automate', desc: 'Lowercase' },
  { name: 'ore::Automate', desc: 'With module path' },
  { name: 'ore:Automate', desc: 'With single colon' },
];

export function getAllDiscriminators(): Array<{ name: string; desc: string; discriminator: Uint8Array; hex: string }> {
  return DISCRIMINATOR_FORMATS.map(format => {
    const hash = sha256(format.name);
    const discriminator = hash.slice(0, 8); // First 8 bytes
    return {
      name: format.name,
      desc: format.desc,
      discriminator: new Uint8Array(discriminator),
      hex: discriminator.toString('hex'),
    };
  });
}

export function printAllDiscriminators(): void {
  console.log('='.repeat(70));
  console.log('ALL POSSIBLE DISCRIMINATORS FOR AUTOMATE INSTRUCTION');
  console.log('='.repeat(70));
  console.log();
  
  const discriminators = getAllDiscriminators();
  discriminators.forEach((disc, index) => {
    const bytes = Array.from(disc.discriminator).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
    const marker = index === 1 ? ' ⬅ CURRENT' : '';
    console.log(`${index + 1}. ${disc.name} (${disc.desc})${marker}`);
    console.log(`   Hex: ${disc.hex}`);
    console.log(`   Bytes: [${bytes}]`);
    console.log();
  });
  
  console.log('='.repeat(70));
  console.log('NOTE: Steel\'s instruction! macro might generate discriminators');
  console.log('differently. We need to test each one or find a real transaction.');
  console.log('='.repeat(70));
}

// Export for use in other files
export default { getAllDiscriminators, printAllDiscriminators };

