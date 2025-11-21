# How to Find the Correct Instruction Name

## Method 1: Find a Real Transaction on Solscan (Recommended)

### Step 1: Go to Solscan
1. Visit: https://solscan.io/
2. In the search bar, enter the ORE program address: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
3. Click on the program result

### Step 2: Find Recent Transactions
1. On the program page, look for a "Transactions" or "Instructions" tab
2. Browse recent transactions to the ORE program
3. Look for transactions that might be automation-related (they might have specific account patterns)

### Step 3: Open a Transaction
1. Click on any transaction that looks relevant
2. Scroll down to see the "Instructions" section
3. Find the instruction that calls the ORE program

### Step 4: Extract Instruction Data
1. In the instruction details, look for "Instruction Data" or "Data"
2. The instruction data should be in hex format
3. **The first 8 bytes (16 hex characters) are the discriminator**
4. Copy those 16 hex characters (e.g., `546aae5e07401682`)

### Step 5: Reverse-Calculate Instruction Name
Once you have the discriminator, I can help reverse-calculate the instruction name, or you can use this:

```javascript
// In browser console, try this:
const crypto = require('crypto'); // In Node.js
// Or use Web Crypto API in browser

// Try different names until discriminator matches
const names = ['automate', 'Automate', 'initialize_automation', ...];
const targetDiscriminator = 'XXXXXXXX'; // The 16 hex chars you found

for (const name of names) {
  const preimage = `global:${name}`;
  const hash = crypto.createHash('sha256').update(preimage).digest();
  const disc = hash.slice(0, 8).toString('hex');
  if (disc === targetDiscriminator) {
    console.log(`Found! Instruction name is: ${name}`);
    break;
  }
}
```

---

## Method 2: Use Solana Explorer

### Step 1: Go to Solana Explorer
1. Visit: https://explorer.solana.com/
2. Search for the ORE program: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`

### Step 2: Find Transactions
1. Click on "Instructions" or "Transactions" tab
2. Browse through recent instructions
3. Click on an instruction that looks relevant

### Step 3: View Instruction Data
1. In the instruction details, look for "Instruction Data"
2. Copy the hex data
3. The first 8 bytes (16 hex characters) are the discriminator

---

## Method 3: Check ORE Program on Solscan - Program Instructions Tab

1. Go to: https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo
2. Look for tabs like "Transactions", "Instructions", or "Program Instructions"
3. Filter or search for recent activity
4. Open a transaction that seems related to automation/initialization
5. Check the instruction data section

---

## Method 4: Search for Known ORE Users/Wallets

If you know someone who uses ORE automation:

1. Find their wallet address on Solscan
2. Look at their transaction history
3. Find transactions to the ORE program
4. Those transactions should show the automation setup instruction

---

## Method 5: Check ORE Program Source Code (If Public)

1. Go to: https://github.com/regolith-labs/ore
2. Navigate to the program source code
3. Look for instruction handlers in `program/src/lib.rs` or `program/src/instruction/`
4. Find the function that handles automation (might be in `automate.rs`)
5. The function name (e.g., `pub fn automate`) is the instruction name

---

## What to Look For

### In Transaction Data:
- **Instruction Data (hex)**: Look like `546aae5e07401682...` 
- **First 16 characters** = 8 bytes = discriminator
- **Remaining bytes** = instruction parameters

### In Program Source:
- Look for: `#[instruction]` or `pub fn` annotations
- Function names like: `automate`, `Automate`, `initialize_automation`, etc.
- The function name becomes the instruction name

---

## Quick Checklist

- [ ] Visit Solscan or Solana Explorer
- [ ] Search for ORE program address
- [ ] Find a recent transaction
- [ ] Open transaction details
- [ ] Locate instruction data (hex format)
- [ ] Copy first 16 hex characters (discriminator)
- [ ] Share discriminator with me to reverse-calculate instruction name

---

## Example: What Instruction Data Looks Like

```
Instruction Data (hex): 546aae5e074016820064190000000000000040420f000000000001
                       └─────────┬─────────┘└──────────────────┬──────────────────┘
                         Discriminator         Instruction Parameters
                         (8 bytes)             (remaining data)
```

The discriminator `546aae5e07401682` (first 8 bytes) is what we need to find the instruction name.

---

## Once You Have the Discriminator

Share the discriminator (8 bytes, 16 hex characters) and I can:
1. Calculate what instruction name produces that discriminator
2. Update the code with the correct discriminator
3. Test the transaction again

---

## Pro Tips

1. **Look for small transactions**: Automation setup transactions are usually small
2. **Check multiple transactions**: Different instructions might use the same program
3. **Filter by date**: Recent transactions are more likely to match current program version
4. **Check account patterns**: Automation transactions might create new accounts (PDAs)
5. **Use browser DevTools**: You can inspect network requests to see transaction data

