# How to Find Discriminator on Solscan

## Step-by-Step Guide

### 1. On the Solscan Transactions Page

You're currently on: https://solscan.io/account/LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo

**Click on any transaction** from the list (preferably a successful one, not failed)

### 2. Transaction Details Page

After clicking a transaction, you'll see the transaction details page. Look for:

**Option A: Instructions Section**
- Scroll down to find "Instructions" section
- Look for the instruction that has program `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
- Click on that instruction to expand it
- Look for "Instruction Data" or "Data" field

**Option B: Raw Transaction View**
- Look for a "Raw" or "JSON" tab
- Find the `instructions` array
- Find the instruction with `programIdIndex` pointing to the ORE program
- Look for the `data` field (base64 encoded)

### 3. Extract Discriminator

For an **Automate** instruction:
- Total instruction data should be **41 bytes**
- **First 8 bytes (16 hex characters)** = discriminator
- Example: If data is `f9dcbb55deba4b9f...`, then `f9dcbb55deba4b9f` is the discriminator

### 4. Share the Discriminator

Copy the first 8 bytes (discriminator) and share them. Format might be:
- Hex: `f9dcbb55deba4b9f`
- Bytes: `0xf9, 0xdc, 0xbb, 0x55, 0xde, 0xba, 0x4b, 0x9f`
- Base64: Decode first, then take first 8 bytes

### 5. Also Check Your Console

When you try the transaction, check browser console (F12) and look for:
```
🔍🔍🔍 AUTOMATE INSTRUCTION DEBUG 🔍🔍🔍
Discriminator (hex): f9dcbb55deba4b9f
Full instruction data (hex): [full hex]
```

Compare this with what you see in the Solscan transaction!

