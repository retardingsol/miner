# Quick Guide: Finding the Instruction Discriminator on Solscan

## Step-by-Step Instructions

### 1. Go to Solscan Program Page
```
https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
```

### 2. Find the Transactions Tab
- Look for tabs like: "Transactions", "Instructions", or "Program Instructions"
- Click on it to see recent transactions

### 3. Open a Recent Transaction
- Click on any recent transaction signature
- This opens the transaction details page

### 4. Find the Instruction Data
- Scroll down to the "Instructions" section
- Look for the instruction that calls the ORE program (`LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`)
- Click on that instruction to expand it

### 5. Copy the Discriminator
- Look for "Instruction Data" or "Data" field
- It will be in hex format, something like: `546aae5e074016820064...`
- **Copy the FIRST 16 characters** (these are the 8 bytes of the discriminator)
- Example: If data is `546aae5e0740168200641900000000000000...`, copy `546aae5e07401682`

### 6. Share the Discriminator
- Send me those 16 hex characters
- I'll calculate what instruction name produces that discriminator
- Then I'll update the code

---

## Alternative: Check Transaction on Solana Explorer

### 1. Go to Solana Explorer
```
https://explorer.solana.com/address/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
```

### 2. Click "Transactions" or "Instructions" Tab

### 3. Open a Transaction and Look for Instruction Data

---

## What the Instruction Data Looks Like

```
Instruction Data (hex):
546aae5e074016820064190000000000000040420f000000000001
└─────────┬─────────┘└─────────────────────────────────┘
    8 bytes              Remaining parameters
  (Discriminator)
  
First 16 hex characters = Discriminator = 546aae5e07401682
```

---

## Quick Test: Try Different Transaction Types

You might need to look at different types of transactions:
- **Account creation transactions**: Automation setup might create new accounts
- **Small transactions**: Automation setup is usually a small operation
- **Recent transactions**: More likely to match current program version

---

## If You Can't Find It

1. Check if Solscan shows "Program Instructions" tab - it might list all instruction types
2. Try searching for a known ORE automation user's wallet
3. Check ORE documentation/Discord for instruction names
4. We can also try testing different instruction names systematically

---

## Once You Have the Discriminator

Share it with me and I'll:
1. Calculate the instruction name that produces that discriminator
2. Update `src/solana/oreDiscriminators.ts` with the correct discriminator
3. Test the transaction again

**Example discriminator format:** `546aae5e07401682` (16 hex characters = 8 bytes)

