# Account Order Verification

This document tracks the verification of account order for ORE program instructions.

## Verified Components

### ✅ Instruction Discriminators
- **`automate`**: `546aae5e07401682` (VERIFIED - calculated from SHA256("global:automate"))
- **`claim_sol`**: `8b71b3bdbe1e84c3` (VERIFIED - calculated from SHA256("global:claim_sol"))

## Account Order (Based on Anchor Patterns)

### Automate Instruction
**Expected Account Order:**
1. **[0]** User authority - `signer=true, writable=true` - User who owns the automation account
2. **[1]** Automation PDA - `signer=false, writable=true` - Automation account to create/update
3. **[2]** Board - `signer=false, writable=false` - Board account (read-only, current round info)
4. **[3]** System Program - `signer=false, writable=false` - System program (for account creation)
5. **[4]** Rent Sysvar - `signer=false, writable=false` - Rent sysvar (for rent calculation)

**Total Accounts: 5**

**Status:** ⚠️ **NEEDS VERIFICATION** - Based on Anchor framework patterns, needs testing on devnet

### ClaimSOL Instruction
**Expected Account Order:**
1. **[0]** User authority - `signer=true, writable=true` - User receiving SOL
2. **[1]** Miner PDA - `signer=false, writable=true` - Miner account (tracks user's round state)
3. **[2]** Round PDA - `signer=false, writable=true` - Round account (tracks round state)
4. **[3]** Board - `signer=false, writable=false` - Board account (read-only, round info)
5. **[4]** Treasury - `signer=false, writable=true` - Treasury account (sends SOL to user)
6. **[5]** System Program - `signer=false, writable=false` - System program (for SOL transfer)

**Total Accounts: 6**

**Status:** ⚠️ **NEEDS VERIFICATION** - Based on Anchor framework patterns, needs testing on devnet

## PDA Derivations

### Automation PDA
```typescript
PublicKey.findProgramAddressSync(
  [stringToUint8Array('automation'), userPubkey.toBuffer()],
  ORE_PROGRAM_ID
)
```
**Status:** ⚠️ **NEEDS VERIFICATION** - Based on common ORE patterns

### Miner PDA
```typescript
PublicKey.findProgramAddressSync(
  [
    stringToUint8Array('miner'),
    userPubkey.toBuffer(),
    roundIdBytes,
  ],
  ORE_PROGRAM_ID
)
```
**Status:** ⚠️ **NEEDS VERIFICATION** - Based on common ORE patterns

### Round PDA
```typescript
PublicKey.findProgramAddressSync(
  [stringToUint8Array('round'), roundIdBytes],
  ORE_PROGRAM_ID
)
```
**Status:** ⚠️ **NEEDS VERIFICATION** - Based on common ORE patterns

## Verification Plan

### Step 1: Test on Devnet
1. Connect wallet to devnet
2. Attempt to create `automate` instruction
3. Check transaction error messages to identify account order issues
4. Iterate until transaction succeeds

### Step 2: Verify Account Properties
- Ensure signer flags are correct
- Ensure writable flags match program expectations
- Verify account pubkeys match expected addresses

### Step 3: Verify PDA Derivations
- Compare derived PDAs with actual account addresses on-chain
- Ensure PDA derivation seeds match ORE program expectations

### Step 4: Document Final Verified Order
- Update this document with verified account order
- Update `oreProgram.ts` with verified order
- Remove TODO comments once verified

## Common Error Patterns

### Wrong Account Order
**Error:** `Instruction #0 failed: custom program error: 0x1`
**Meaning:** Account order mismatch - program expects different account at that position

### Wrong PDA Derivation
**Error:** `Instruction #0 failed: Invalid account`
**Meaning:** PDA derivation seeds are incorrect - account doesn't match expected PDA

### Missing Account
**Error:** `Missing required account`
**Meaning:** Not enough accounts provided - missing required account

### Wrong Account Properties
**Error:** `Account is not writable` or `Account is not signer`
**Meaning:** Account flags (isSigner, isWritable) don't match program expectations

## Next Steps

1. ✅ **Discriminators Verified** - Completed
2. ⚠️ **Account Order** - Ready for devnet testing
3. ⚠️ **PDA Derivations** - Ready for devnet testing
4. ⏳ **Devnet Testing** - Next step

