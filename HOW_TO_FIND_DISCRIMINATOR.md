# How to Find the Correct Discriminator

Since we're still getting `0x65` errors, we need to extract the discriminator from a **real on-chain transaction**. Here's how:

## Method 1: Use Solscan/Explorer (RECOMMENDED)

1. **Go to [Solscan](https://solscan.io) or [Solana Explorer](https://explorer.solana.com)**
2. **Search for the ORE program**: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
3. **Find a recent successful transaction** (not failed)
4. **Click on the transaction** to view details
5. **Look for the "Instruction Data" section**
6. **The first 8 bytes are the discriminator**

For an Automate transaction:
- Instruction data should be **41 bytes** total
- First 8 bytes = discriminator
- Next 33 bytes = struct data (amount, deposit, fee, mask, strategy)

## Method 2: Use RPC to Find Transactions

We can query the RPC for transactions and extract instruction data, but it's harder to identify which are Automate calls.

## Method 3: Check Debug Console

Check your browser console - the debug log shows:
```
🔍 Automate instruction data:
  length: 41
  discriminator: 0xf9, 0xdc, 0xbb, 0x55, 0xde, 0xba, 0x4b, 0x9f
  fullHex: [full hex]
```

Compare this with what you see in a real transaction on Solscan.

## Discriminators We've Tried

1. `SHA256("global:Automate")[:8]` = `ed7408425064bd96` ❌
2. `SHA256("Automate")[:8]` = `f9dcbb55deba4b9f` ❌ (current)
3. `SHA256("global:automate")[:8]` = `546aae5e07401682` ❌
4. `SHA256("global:process_automate")[:8]` = `8493ea04d539f386` ❌
5. `[0x00]` (1-byte enum value) ❌

## Next Steps

1. **Find a real Automate transaction on Solscan**
2. **Extract the exact discriminator** (first 8 bytes of instruction data)
3. **Compare with what we're sending** (check console debug log)
4. **Update discriminator** to match exactly

This is the most reliable way to get the correct discriminator format.

