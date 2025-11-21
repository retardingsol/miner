# Deploy Instruction Debug Info

## Verified from instruction.rs
- **Deploy = 6** (confirmed from enum)
- **Reset = 9** (confirmed from enum, and works with discriminator `09`)
- So Deploy should use discriminator `06` (1 byte)

## Current Implementation
- Discriminator: `0x06` (1 byte) ✓
- Instruction data: `[0x06] + amount (8 bytes) + mask (4 bytes)` = 13 bytes total ✓
- Account order: `[signer, authority, automation, board, miner, round, system_program, entropy_var, entropy_api]` ✓

## Why It's Still Failing
The discriminator format appears correct based on Reset working with `09`. The error `InstructionFallbackNotFound (0x65)` means the program doesn't recognize the instruction.

**Possible causes:**
1. **Account order mismatch** - Even if accounts match SDK.rs, maybe one account is in wrong position
2. **PDA derivation issue** - Especially entropy_var PDA might be wrong
3. **Account writability flags** - One account might have wrong isWritable flag
4. **Program ID mismatch** - Using wrong program ID (unlikely, we verified this)

## Next Steps
1. **Find a real Deploy transaction** to verify:
   - Actual discriminator value
   - Account order
   - Account writability flags

2. **Double-check entropy_var PDA derivation:**
   - Uses Entropy API program ID: `3jSkUuYBoJzQPMEzTvkDFXCZUBksPamrVhrnHR9igu2X`
   - Seeds: `['var', board_address, var_id (u64)]`
   - var_id = 0 for ORE

3. **Verify all PDAs match SDK.rs exactly**

