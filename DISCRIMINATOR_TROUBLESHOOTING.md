# Discriminator Troubleshooting Guide

## Current Status
Still getting `0x65` error even after trying multiple discriminator formats.

## Discriminators Tried
1. ✅ `SHA256("global:Automate")[:8]` = `ed7408425064bd96` ❌ Failed
2. ✅ `SHA256("Automate")[:8]` = `f9dcbb55deba4b9f` ❌ Failed (current)
3. ✅ `SHA256("global:automate")[:8]` = `546aae5e07401682` ❌ Failed
4. ✅ `SHA256("global:process_automate")[:8]` = `8493ea04d539f386` ❌ Failed
5. ✅ `[0x00]` (1-byte enum value) ❌ Failed

## Verification Needed

### 1. Check Console Debug Log
When you try the transaction, check the browser console for:
```
🔍 Automate instruction data:
  length: 41
  discriminator: 0xf9, 0xdc, 0xbb, 0x55, 0xde, 0xba, 0x4b, 0x9f
  fullHex: [hex string]
  first16Bytes: [hex string]
```

This shows what we're actually sending.

### 2. Account Order - VERIFIED ✓
Our account order matches SDK exactly:
- [0] signer (signer, writable)
- [1] automation PDA (writable)
- [2] executor (writable)
- [3] miner PDA (writable)
- [4] system_program (read-only)

### 3. PDA Derivations - VERIFIED ✓
- Automation PDA: `[b"automation", signer.key.to_bytes()]` ✓
- Miner PDA: `[b"miner", signer.key.to_bytes()]` ✓

## Next Steps - Find Real Transaction

The **best way** to get the correct discriminator is to find a **real on-chain Automate transaction**:

1. Go to **Solscan**: https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
2. Look for transactions with **41 bytes of instruction data** (Automate instruction)
3. Click on the transaction to see details
4. Look at "Instruction Data" - first 8 bytes are the discriminator
5. Compare with our console debug log

Alternatively:
- Ask in ORE Discord: https://discord.com/invite/ore
- Check ORE GitHub issues for examples
- Use ore-cli to generate a transaction and analyze it

## Alternative: Try All Possible Formats

If we can't find a real transaction, we could try:
1. `SHA256("OreInstruction::Automate")[:8]`
2. `SHA256("ore::Automate")[:8]`
3. Just the enum value as u64: `[0, 0, 0, 0, 0, 0, 0, 0]` (all zeros)
4. Check if steel has a different namespace format

But finding a real transaction is the most reliable method.

