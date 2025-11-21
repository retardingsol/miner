# Finding the Correct Deploy Discriminator

## Current Issue
- Reset instruction uses discriminator `0x09` (confirmed from real transaction)
- Deploy instruction with discriminator `0x06` is still failing
- Error: `InstructionFallbackNotFound (0x65/101)`

## Possible Issues

1. **Discriminator might be wrong** - Deploy enum value might not be 6
2. **Discriminator format might be different** - Maybe it's not 1-byte for all instructions?
3. **Account order might be wrong** - Need to verify against SDK.rs exactly
4. **PDA derivations might be wrong** - Especially entropy_var PDA

## Next Steps

1. **Find a real Deploy transaction on Solscan/Explorer**
   - Search for transactions to ORE program: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
   - Look for transactions with 9 accounts (Deploy uses 9 accounts)
   - Extract the first byte(s) of instruction data as the discriminator

2. **Check if discriminator format varies by instruction**
   - Reset = 9 → shows as `09` (1 byte)
   - Deploy = 6 → should show as `06` (1 byte)?
   - But maybe Deploy uses a different format?

3. **Verify account order matches SDK.rs exactly**
   - Current order: [signer, authority, automation, board, miner, round, system_program, entropy_var, entropy_api]
   - Need to verify this matches SDK.rs exactly

4. **Verify PDA derivations**
   - Check that all PDAs are derived correctly
   - Especially check entropy_var PDA derivation

## How to Find Real Deploy Transaction

1. Go to Solscan: https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
2. Look for recent transactions
3. Find one with 9 accounts (Deploy instruction)
4. Click on the transaction
5. Find the instruction data (should start with discriminator)
6. First byte(s) = discriminator for Deploy

## Alternative: Check ORE Program Source Code

Look at the instruction enum in `program/src/instruction.rs` to confirm Deploy = 6.

