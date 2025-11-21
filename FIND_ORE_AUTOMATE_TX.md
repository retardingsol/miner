# How to Find ORE Automate Transactions

## The Problem
The transaction you're viewing is a **swap transaction**, not an ORE `Automate` instruction. We need to find a transaction that actually calls the ORE program's `Automate` instruction.

## Method 1: Filter by Instruction Type (Recommended)

### On Solscan:
1. Go back to the account page: https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
2. Look for a **filter** or **search** option
3. Try to filter for transactions with:
   - Instruction data length = **41 bytes** (Automate instruction)
   - Or look for transactions that create "automation" accounts

### Alternative: Look for Recent Successful Transactions
1. On the account page, look for transactions that:
   - Are **successful** (green checkmark)
   - Have **fewer instructions** (Automate is usually simpler than swaps)
   - Show the ORE program ID: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`

## Method 2: Use Solana Explorer Instead

1. Go to: https://explorer.solana.com/address/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
2. Look for transactions that show:
   - Program: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
   - Instruction data: **41 bytes** (for Automate)

## Method 3: Check ORE Official Site

1. Go to the official ORE site (ore.supply or similar)
2. Set up automation there
3. Copy the transaction signature
4. View it on Solscan/Explorer
5. That transaction will have the correct Automate instruction format

## What to Look For

An **Automate** instruction should have:
- **Instruction data length**: 41 bytes
- **First 8 bytes**: The discriminator (what we need!)
- **Program ID**: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
- **Accounts**: Should include automation PDA, miner PDA, etc.

## Quick Check

If you find a transaction, look for:
- Instruction data showing as hex (like: `f9dcbb55deba4b9f...`)
- The **first 16 hex characters** (8 bytes) = discriminator
- Share those first 16 hex characters with me!

