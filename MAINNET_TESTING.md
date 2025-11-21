# Mainnet Testing Guide

⚠️ **WARNING: Testing on Mainnet uses REAL SOL** ⚠️
- Only use very small amounts (0.001 SOL or less)
- Transactions on mainnet are final and cannot be reversed
- Make sure you understand the risks before proceeding

## Steps to Switch to Mainnet

### 1. Update Environment Configuration

Remove or update your `.env` file:

**Option A: Remove devnet setting (uses mainnet by default)**
```bash
# Remove VITE_SOLANA_NETWORK=devnet or comment it out
# VITE_SOLANA_NETWORK=devnet
```

**Option B: Explicitly set mainnet**
```bash
VITE_SOLANA_NETWORK=mainnet-beta
```

**Option C: Use a custom mainnet RPC endpoint (recommended)**
```bash
# Remove VITE_SOLANA_NETWORK if using custom RPC
VITE_SOLANA_RPC_URL=https://your-mainnet-rpc-url.com
# Or use Helius, QuickNode, etc.
```

### 2. Switch Phantom Wallet to Mainnet

1. Open Phantom wallet
2. Go to Settings → Developer Mode
3. **Disable "Testnet Mode"** (turn it off)
4. Wallet will automatically switch to Mainnet
5. Verify you see "Mainnet" in the wallet UI

### 3. Ensure You Have SOL (Real SOL, not testnet)

- Make sure your wallet has a small amount of real SOL
- Recommended: At least 0.01 SOL for testing (covers transaction fees + test amounts)
- You'll need SOL for:
  - Transaction fees (~0.000005 SOL per transaction)
  - Rent for account creation (~0.001-0.002 SOL)
  - Your test automation amounts (use 0.001 SOL or less)

### 4. Restart the Development Server

After updating `.env`, restart your dev server:

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

### 5. Clear Browser Cache (Optional but Recommended)

Sometimes the browser caches the old network setting:
- Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Or clear browser cache for localhost

### 6. Test with Minimal Amounts

⚠️ **IMPORTANT: Use VERY SMALL amounts for testing!**

Recommended test values:
- **SOL per block**: 0.001 SOL or less
- **Blocks**: 1-5 blocks (not all 25)
- **Total**: Keep total under 0.01 SOL for initial tests

## Testing Checklist

- [ ] `.env` file updated (removed devnet setting)
- [ ] Phantom wallet switched to Mainnet
- [ ] Wallet has real SOL (at least 0.01 SOL)
- [ ] Dev server restarted
- [ ] Browser cache cleared (hard refresh)
- [ ] Connected wallet in app (verify it shows mainnet)
- [ ] Set SOL amount to 0.001 or less
- [ ] Set blocks to small number (1-5)
- [ ] Ready to test automation setup

## Expected Results

### If Instruction Discriminator is Correct:
- ✅ Transaction should succeed
- ✅ Automation account should be created
- ✅ You'll see success message with transaction signature

### If Instruction Discriminator is Still Wrong:
- ❌ Same error: `custom program error: 0x65`
- This means the instruction name "automate" is incorrect
- Need to find actual instruction name from ORE source code

### If Account Order is Wrong:
- ❌ Error like `custom program error: 0x1` or `Invalid account`
- Will indicate which account is wrong
- Can adjust account order based on error

## Safety Tips

1. **Start Small**: Never test with large amounts
2. **One Transaction at a Time**: Wait for each transaction to complete
3. **Check Transaction on Explorer**: Verify it looks correct before submitting
4. **Keep Browser Console Open**: Watch for errors and transaction signatures
5. **Have Backup SOL**: Don't test with your entire SOL balance

## Transaction Explorer Links

After submitting, you can view your transaction:
- **Solscan**: https://solscan.io/tx/{signature}
- **Solana Explorer**: https://explorer.solana.com/tx/{signature}

## If Something Goes Wrong

1. **Transaction Stuck**: Check on Solscan to see status
2. **Wrong Amount Sent**: Transactions are final - cannot be reversed
3. **Need Help**: Check browser console for detailed error messages
4. **Revert to Devnet**: Just set `VITE_SOLANA_NETWORK=devnet` again and restart

## Notes

- The ORE program on mainnet is the production version
- If it works on mainnet but not devnet, the devnet version might be different
- If it doesn't work on mainnet either, we need to find the correct instruction name

