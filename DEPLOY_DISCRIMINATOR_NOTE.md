# Deploy Discriminator Issue

## Current Status
- Reset instruction uses discriminator `0x09` (1 byte) - **CONFIRMED from real transaction**
- Deploy instruction with discriminator `0x06` (1 byte) is **FAILING**

## What We Know
- From instruction.rs enum: `Deploy = 6`
- Reset = 9 → shows as `09` (1 byte) in real transaction
- Deploy = 6 → should show as `06` (1 byte) - **BUT IT'S FAILING**

## Possible Issues

1. **Deploy enum value might not be 6**
   - Maybe there are other instructions between ClaimORE (4) and Deploy (6)?
   - Could be: Automate=0, ClaimSOL=3, ClaimORE=4, ???=5, Deploy=6, ???=7, ???=8, Reset=9

2. **Discriminator format might vary by instruction type**
   - Maybe Deploy uses a different format than Reset?

3. **Need to extract from real transaction**
   - Find a real Deploy transaction on Solscan
   - Extract the first byte of instruction data
   - That will be the actual discriminator

## Next Action Required

**Find a real Deploy transaction** to confirm the discriminator:
- Search Solscan for ORE program transactions
- Look for transactions with 9 accounts (Deploy signature)
- Extract discriminator from first byte(s) of instruction data

