# ORE Autominer Implementation Options

## Option A: Custom AutoMine Manager Program (On-Chain Vault)

**How it works:**
1. **Deploy a custom Solana program** that acts as a vault manager
2. **User deposits SOL** into a Program Derived Address (PDA) owned by your program
3. **Store configuration on-chain** (risk profile, max SOL per round, enabled/disabled)
4. **Backend bot monitors rounds** and when conditions are met, calls `ExecuteAutomine` instruction
5. **Program validates** constraints (max SOL per round, max total, risk profile)
6. **Program calls ORE program** directly with user's SOL from the vault

**Pros:**
- ✅ Centralized vault management
- ✅ Clear permission model (program controls vault)
- ✅ Configurable limits enforced on-chain
- ✅ Backend bot can execute without user signing each transaction
- ✅ Users can see their vault balance on-chain

**Cons:**
- ❌ Requires deploying and maintaining a Solana program
- ❌ More complex (program development, testing, upgrades)
- ❌ Higher initial setup cost (rent for accounts)
- ❌ Need to handle program upgrades if logic changes

**Architecture:**
```
User Wallet → [Deposit] → AutoMine Vault (PDA)
                              ↓
Backend Bot → [ExecuteAutomine] → ORE Program
                              ↓
                        User's SOL used for mining
```

---

## Option B: Direct ORE Program Integration (Recommended)

**How it works:**
1. **No wrapper program needed** - interact with ORE program directly
2. **SOL stays in user's wallet** - no deposits required
3. **User authorizes backend bot once** (via signing authority or API key)
4. **Backend bot monitors rounds** and builds transactions when conditions are met
5. **User signs transactions** (or bot has delegated signing authority)
6. **Transactions call ORE program** directly with user's SOL

**Pros:**
- ✅ Simpler - no program deployment needed
- ✅ Faster to implement
- ✅ Direct control - user's SOL never leaves their wallet
- ✅ Lower cost (no rent for program accounts)

**Cons:**
- ❌ User must sign each transaction (or grant signing authority)
- ❌ More transactions (each mining action is a separate transaction)
- ❌ Backend bot needs to be trusted or user must review each transaction

**Architecture:**
```
User Wallet (SOL stays here)
    ↓
Backend Bot → [Build Transaction] → User Signs → ORE Program
    ↓
Conditions met? → Execute mining with user's SOL
```

**Implementation:**
- Use ORE Program ID: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
- Build `Claim` instructions directly for the ORE program
- Use user's wallet SOL to fund the mining transactions
- Backend bot monitors rounds and triggers transactions when EV is positive

