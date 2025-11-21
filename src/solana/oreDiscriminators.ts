/**
 * ORE Program Instruction Discriminators
 * 
 * Based on real transaction analysis from Solscan:
 * - Reset instruction uses discriminator 0x09 (single byte, not 8 bytes!)
 * - Steel framework uses 1-byte enum discriminant values directly
 * - The "AnchorError" message is misleading - Steel uses 1-byte discriminators
 * 
 * From enum: https://raw.githubusercontent.com/regolith-labs/ore/master/api/src/instruction.rs
 * - Automate = 0
 * - ClaimSOL = 3
 * - ClaimORE = 4
 * - Deploy = 6
 * - Reset = 9 (confirmed from real transaction: instruction data starts with 09)
 * 
 * Format: Single byte enum value (u8), NOT 8-byte padded!
 */
export const ORE_DISCRIMINATORS = {
  // Automation instruction - 1-byte enum value
  // From enum: Automate = 0 (u8)
  AUTOMATE: new Uint8Array([0x00]), // 0x00 (1 byte)
  
  // Claim SOL instruction - 1-byte enum value
  // From enum: ClaimSOL = 3 (u8)
  CLAIM_SOL: new Uint8Array([0x03]), // 0x03 (1 byte)
  
  // Claim ORE instruction - 1-byte enum value
  // From enum: ClaimORE = 4 (u8)
  CLAIM_ORE: new Uint8Array([0x04]), // 0x04 (1 byte)
  
  // Deploy instruction - 1-byte enum value
  // From enum: Deploy = 6 (u8)
  // Confirmed format from Reset = 9 (0x09) in real transaction
  DEPLOY: new Uint8Array([0x06]), // 0x06 (1 byte)
  
  // Reset instruction - confirmed from real transaction (for reference)
  // From enum: Reset = 9 (u8), transaction shows 0x09
  RESET: new Uint8Array([0x09]), // 0x09 (1 byte)
};

/**
 * Helper to verify discriminator matches expected value
 */
export function verifyDiscriminator(data: Uint8Array, expected: Uint8Array): boolean {
  if (data.length < expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (data[i] !== expected[i]) return false;
  }
  return true;
}

