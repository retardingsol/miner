# Devnet Testing Guide

This guide explains how to test the ORE autominer on Solana devnet.

## Prerequisites

1. **Phantom Wallet** (or another Solana wallet) with devnet SOL
   - Get devnet SOL from: https://faucet.solana.com/

2. **Environment Configuration**
   - Create a `.env` file in the project root
   - Add: `VITE_SOLANA_NETWORK=devnet`
   - Or set a custom devnet RPC: `VITE_SOLANA_RPC_URL=https://api.devnet.solana.com`

## Setup Instructions

### 1. Configure Devnet Network

Create or update `.env` file:
```bash
VITE_SOLANA_NETWORK=devnet
```

Or use a custom devnet RPC endpoint:
```bash
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### 2. Switch Phantom Wallet to Devnet

1. Open Phantom wallet
2. Go to Settings → Developer Mode → Testnet Mode
3. Enable Testnet Mode
4. Switch network to Devnet

### 3. Get Devnet SOL

1. Visit https://faucet.solana.com/
2. Enter your wallet address
3. Request devnet SOL (you can request multiple times)

## Testing Checklist

### ✅ Test 1: Connect Wallet on Devnet
- [ ] Connect wallet in the app
- [ ] Verify wallet address is displayed
- [ ] Verify network shows devnet

### ✅ Test 2: Setup Automation (Automate Instruction)
- [ ] Enter SOL amount (e.g., 0.001 SOL per block)
- [ ] Select blocks (e.g., 25 for all blocks)
- [ ] Select risk profile (e.g., "All 25 Blocks")
- [ ] Click "Setup Automation"
- [ ] **Expected Results:**
  - If ORE program exists on devnet: Transaction succeeds
  - If ORE program doesn't exist: Error "Program account does not exist"
  - If account order is wrong: Error with program error code

**Common Errors:**
- `Program account does not exist` - ORE program not deployed on devnet
- `custom program error: 0x1` - Account order mismatch
- `Invalid account` - Wrong PDA derivation
- `Missing required account` - Not enough accounts provided

### ✅ Test 3: Verify Account Order
- [ ] Check browser console for transaction details
- [ ] Check transaction on Solana Explorer (devnet)
- [ ] Verify account order matches expected:
  ```
  [0] User authority (signer, writable)
  [1] Automation PDA (writable)
  [2] Board (read-only)
  [3] System Program (read-only)
  [4] Rent Sysvar (read-only)
  ```

### ✅ Test 4: Claim SOL (if applicable)
- [ ] Attempt to claim SOL from a completed round
- [ ] Verify account order:
  ```
  [0] User authority (signer, writable)
  [1] Miner PDA (writable)
  [2] Round PDA (writable)
  [3] Board (read-only)
  [4] Treasury (writable)
  [5] System Program (read-only)
  ```

## Troubleshooting

### Issue: "Program account does not exist"
**Solution:** The ORE program may not be deployed on devnet. You have two options:
1. Deploy a test version of the ORE program to devnet
2. Test on mainnet with small amounts (use at your own risk)

### Issue: "custom program error: 0x1" or similar
**Solution:** This indicates an account order mismatch or invalid account:
1. Check browser console for detailed error
2. Compare account order with expected order in `ACCOUNT_ORDER_VERIFICATION.md`
3. Verify PDA derivations are correct
4. Adjust account order based on error message

### Issue: "Invalid account"
**Solution:** PDA derivation might be wrong:
1. Verify PDA derivation seeds match ORE program expectations
2. Check if account exists on-chain
3. Ensure user pubkey is correct

### Issue: Transaction times out
**Solution:** 
1. Check RPC endpoint is responsive
2. Try using a different devnet RPC endpoint
3. Increase transaction confirmation timeout

## Debugging Tips

### Enable Detailed Logging
Check browser console for:
- Transaction signatures
- Account addresses
- Error details
- PDA derivations

### Check Transaction on Explorer
1. Copy transaction signature from console
2. Visit: https://explorer.solana.com/tx/{signature}?cluster=devnet
3. Review instruction details and account list

### Verify PDA Derivations
Use Solana Explorer to check if PDAs exist:
- Automation PDA: `[automation, userPubkey]`
- Miner PDA: `[miner, userPubkey, roundId]`
- Round PDA: `[round, roundId]`

## Next Steps After Successful Devnet Testing

1. ✅ Verify account order is correct
2. ✅ Verify PDA derivations are correct
3. ✅ Verify instruction discriminators are correct
4. ✅ Document any corrections needed
5. ⏳ Test on mainnet with small amounts (production)

## Notes

- **ORE Program on Devnet:** The ORE program may not be deployed on devnet. If you get "Program account does not exist", you'll need to either:
  - Deploy the ORE program to devnet yourself
  - Test on mainnet with very small amounts
  
- **Account Order:** If you get account order errors, compare the error with the expected order in `ACCOUNT_ORDER_VERIFICATION.md` and adjust accordingly.

- **PDA Derivations:** PDA derivations must match exactly what the ORE program expects. Verify the seeds used for derivation.

