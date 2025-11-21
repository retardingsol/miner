/**
 * Test script to systematically try all possible discriminator formats
 * This will help us find which format Steel's instruction! macro actually uses
 */

import { Buffer } from 'buffer';
import crypto from 'crypto';

// Helper to calculate SHA256
function sha256(data: string): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

// All possible formats to test
const FORMATS = [
  { name: '1-byte enum value', desc: 'Just the enum value (0x00)', discriminator: Buffer.from([0x00]) },
  { name: 'Anchor (global:Automate)', desc: 'Standard Anchor format', discriminator: sha256('global:Automate').slice(0, 8) },
  { name: 'Anchor (Automate)', desc: 'Without global prefix', discriminator: sha256('Automate').slice(0, 8) },
  { name: 'Anchor (OreInstruction::Automate)', desc: 'With enum path', discriminator: sha256('OreInstruction::Automate').slice(0, 8) },
  { name: 'Anchor (ore::Automate)', desc: 'With module path', discriminator: sha256('ore::Automate').slice(0, 8) },
];

// Test instruction data format: discriminator + struct fields
// Automate struct: amount (8), deposit (8), fee (8), mask (8), strategy (1) = 33 bytes
function createTestInstruction(format: { name: string; desc: string; discriminator: Buffer }): Buffer {
  const structData = Buffer.alloc(33); // 8 + 8 + 8 + 8 + 1 = 33 bytes for struct fields
  // Fill with test values
  structData.writeBigUInt64LE(BigInt(1000000), 0); // amount
  structData.writeBigUInt64LE(BigInt(0), 8); // deposit
  structData.writeBigUInt64LE(BigInt(0), 16); // fee
  structData.writeBigUInt64LE(BigInt(0x1FFFFFF), 24); // mask (all 25 blocks)
  structData.writeUInt8(0, 32); // strategy
  
  return Buffer.concat([format.discriminator, structData]);
}

console.log('='.repeat(70));
console.log('SYSTEMATIC DISCRIMINATOR FORMAT TESTING');
console.log('='.repeat(70));
console.log();

FORMATS.forEach((format, idx) => {
  const instruction = createTestInstruction(format);
  const discriminatorHex = format.discriminator.toString('hex');
  const instructionHex = instruction.toString('hex');
  
  console.log(`${idx + 1}. ${format.name}`);
  console.log(`   Description: ${format.desc}`);
  console.log(`   Discriminator length: ${format.discriminator.length} byte(s)`);
  console.log(`   Discriminator (hex): ${discriminatorHex}`);
  console.log(`   Full instruction length: ${instruction.length} bytes`);
  console.log(`   First 16 bytes (hex): ${instructionHex.substring(0, 32)}`);
  console.log();
});

console.log('='.repeat(70));
console.log('NOTE: We need to test each format to see which one works.');
console.log('='.repeat(70));

export { FORMATS, createTestInstruction };

