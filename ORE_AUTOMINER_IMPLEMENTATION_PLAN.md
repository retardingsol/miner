# ORE Autominer Implementation Plan

Based on the [ORE Program Repository](https://github.com/regolith-labs/ore) and [ORE CLI](https://github.com/regolith-labs/ore-cli), this document outlines the implementation plan for building an **autominer-only** solution that leverages ORE's built-in automation system.

**Key Principle:** We are building an autominer that uses ORE's `Automate` instruction - **NO manual mining functionality**.

## Key Findings from ORE Program

### Relevant Instructions

1. **`Deploy`** - Deploys SOL to claim space on the board (the main mining action)
2. **`Automate`** - Configures a new automation (built-in automation support!)
3. **`Checkpoint`** - Checkpoints rewards from a prior round
4. **`ClaimSOL`** - Claims SOL mining rewards
5. **`ClaimORE`** - Claims ORE mining rewards

### State Accounts

1. **`Automation`** - Tracks automation configs (perfect for our use case!)
2. **`Board`** - Tracks current round number and timestamps
3. **`Round`** - Tracks game state for a given round
4. **`Miner`** - Tracks a miner's game state
5. **`Treasury`** - Mints, burns, and escrows ORE tokens
6. **`Config`** - Global program configs

## Implementation Strategy

**Focus: Automation Only - No Manual Mining**

We will exclusively use ORE's built-in `Automate` instruction. The automation system handles all mining operations automatically based on configured parameters. Users only configure their automation settings, and the backend bot (or ORE's automation system) handles deployments.

### Phase 1: ORE Automation Integration (Primary Focus)

**Goal:** Leverage ORE's built-in `Automate` instruction for fully automated mining

**Key Insight from ore-cli:**
- The [ore-cli repository](https://github.com/regolith-labs/ore-cli) contains Rust code that interacts with the ORE program
- We can examine the CLI source code to understand:
  - How to build `Automate` instructions
  - Account structures and PDA derivations
  - Data serialization formats
  - Error handling patterns

**Components:**
1. **Research `Automate` Instruction**
   - Examine [ore-cli source code](https://github.com/regolith-labs/ore-cli) to understand automation implementation
   - Study ORE program instruction format from repository
   - Understand automation parameters:
     - EV threshold (basis points)
     - Number of blocks to target (1-25)
     - Max SOL per round
     - Enabled/disabled state
   - Learn how automation triggers deployments automatically

2. **Build `Automate` Instruction Builder**
   - Create `createAutomateInstruction()` in TypeScript
   - Derive Automation PDA account
   - Serialize instruction data correctly
   - Build account list (user, automation PDA, board, treasury, system program, etc.)

3. **UI for Automation Configuration**
   - Replace "Initialize Auto-mine Account" with "Setup Automation"
   - Risk profile mapping:
     - `beginner`: EV threshold 200 bps, 15 blocks
     - `balanced`: EV threshold 100 bps, 13 blocks
     - `aggressive`: EV threshold 50 bps, 10 blocks
     - `67`: EV threshold 25 bps, 7 blocks
     - `scotch pilgrim`: EV threshold 75 bps, 12 blocks
     - `all25`: EV threshold 0 bps, 25 blocks (bet on everything)
   - Store automation config on-chain (via `Automate` instruction)
   - Allow users to update automation settings
   - Enable/disable automation toggle
   - Display automation status (active/inactive, last deployment, etc.)

4. **Automation Execution (How It Works)**
   - **Option A**: ORE's automation system handles deployments automatically
     - Once configured, the ORE program monitors rounds and deploys based on config
     - No backend bot needed - fully on-chain automation
   - **Option B**: Backend bot triggers automation
     - Monitor active rounds via API
     - Calculate EV based on current round state
     - Call automation trigger when conditions are met
     - Bot must determine which approach ORE uses

5. **Update/Delete Automation**
   - Allow users to update automation parameters
   - Allow users to disable automation
   - Clean up automation accounts if needed

**Goal:** Display automation status and mining activity

**Components:**
1. **Automation Status Display**
   - Show if automation is active/inactive
   - Display current automation config (risk profile, EV threshold, blocks)
   - Show last deployment round
   - Display total SOL deployed by automation
   - Show pending rewards (if any)

2. **Mining Activity Tracking**
   - Poll miner account state to track deployments
   - Display current round activity
   - Show deployed squares and amounts
   - Calculate and display expected value

### Phase 3: Manual SOL Claiming

**Goal:** Allow users to manually claim their SOL back after rounds

**Important:** 
- **NO automatic reward claiming** - users must manually claim
- **Only SOL claiming** - simple "Claim SOL" button to get deployed SOL back
- ORE rewards can be claimed separately if needed (future feature)

**Components:**
1. **Reward Detection**
   - Poll miner account state to detect pending SOL
   - Check if SOL is available for claim
   - Display pending SOL amount clearly

2. **Claim Instructions**
   - Implement `ClaimSOL` to claim SOL rewards
   - Reference [ore-cli](https://github.com/regolith-labs/ore-cli) for claim implementation patterns
   - Note: `Checkpoint` may be needed first - research this requirement

3. **UI Integration**
   - Show pending SOL amount prominently
   - **"Claim SOL" button** (simple, clear label)
   - Button only enabled when SOL is available to claim
   - Display transaction status (pending, success, error)
   - Show transaction signature/link
   - Display total claimed SOL over time

## Technical Implementation Details

### Step 1: Research ORE Program Structure

**Tasks:**
1. **Examine ORE Program Repository**
   - Clone or browse [ORE program repository](https://github.com/regolith-labs/ore)
   - Find instruction definitions (likely in `program/src/instruction.rs`)
   - Find account structures (likely in `program/src/state/`)
   - Focus on `Automate` instruction format

2. **Examine ORE CLI Implementation**
   - Clone or browse [ORE CLI repository](https://github.com/regolith-labs/ore-cli)
   - Review `src/` directory for automation implementation
   - Study how CLI builds `Automate` instructions
   - Understand account derivations used in CLI

3. **Document Findings**
   - Instruction discriminators (u8 values)
   - Account order and requirements for `Automate`
   - Data serialization format
   - PDA derivations (Automation, Board, Round, Miner, Treasury)
   - How automation actually works (on-chain vs bot-triggered)

**Deliverables:**
- Instruction format documentation (especially `Automate`)
- Account structure mappings
- TypeScript type definitions
- Understanding of automation execution model

### Step 2: Build Instruction Builders

**Tasks:**
1. Create `src/solana/oreInstructions.ts`:
   - `createAutomateInstruction()` - **PRIMARY FOCUS**
     - Parameters: user, evThreshold, numBlocks, maxSolPerRound, enabled
     - Derive Automation PDA
     - Build account list
     - Serialize instruction data
   - `updateAutomateInstruction()` - Update existing automation
   - `createClaimSOLInstruction()` - **Claim SOL rewards** (manual only)
     - Simple instruction to claim deployed SOL back
     - Research if `Checkpoint` is needed first

2. Helper functions:
   - `deriveAutomationPDA(userPubkey)` - Derive Automation PDA
   - `deriveBoardPDA()` - Derive Board PDA
   - `deriveRoundPDA(roundId)` - Derive Round PDA
   - `deriveMinerPDA(userPubkey, roundId)` - Derive Miner PDA
   - `deriveTreasuryPDA()` - Derive Treasury PDA
   - Data serialization (u64, u16, u8, bool)
   - Account list builders

**Dependencies:**
- ORE program ID: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo` (known)
- ORE mint: `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp` (known)
- Board/Treasury pubkeys (need to fetch from health endpoint)

### Step 3: Integrate with AutoMinePanel

**Tasks:**
1. **Replace placeholder with ORE Automation**
   - Remove "Initialize Auto-mine Account" (deprecated)
   - Remove deposit/withdraw (not needed - SOL stays in user wallet)
   - Replace with "Setup Automation" or "Update Automation"

2. **Automation Setup UI**
   - Risk profile dropdown (beginner, balanced, aggressive, 67, scotch pilgrim, all25)
   - SOL amount input (for max SOL per round)
   - Display calculated EV threshold and blocks based on risk profile
   - "Setup Automation" button that:
     - Builds `Automate` instruction
     - Signs and sends transaction
     - Shows success/error feedback
   - "Update Automation" button for existing automations
   - Enable/disable toggle for automation

3. **Automation Status Display**
   - Poll Automation account state
   - Display current automation config
   - Show automation status (active/inactive)
   - Display last deployment info
   - Show pending rewards

4. **Manual SOL Claiming UI**
   - Poll for pending SOL from Miner account
   - Display pending SOL amount clearly
   - **"Claim SOL" button** (enabled only when SOL available)
   - Show transaction status and signature
   - Display total claimed SOL (optional stats)
   - **NO automatic claiming** - user must click button

**Dependencies:**
- Step 1 and Step 2 completed
- Round ID from state API (already available)

### Step 4: Testing

**Tasks:**
1. Unit tests for instruction builders
2. Integration tests with devnet/localnet
3. Mainnet testing with small amounts
4. Error handling for edge cases:
   - Round ended mid-transaction
   - Insufficient SOL
   - Invalid square index
   - Transaction failures

## Current State Assessment

### What We Have:
✅ ORE Program ID: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
✅ ORE Mint Address: `oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp`
✅ State API integration (round ID, board state)
✅ Wallet connection (Solana wallet adapter)
✅ UI structure (AutoMinePanel component)
✅ Risk profile calculations
✅ `@solana/spl-token` package installed

### What We Need:
❌ ORE instruction format documentation (need to examine repository)
❌ Account PDA derivations (Board, Round, Miner, Treasury, Automation)
❌ Instruction data serialization format
❌ Board and Treasury pubkeys (can fetch from health endpoint)
❌ Actual instruction builders (currently placeholders)

## Recommended Implementation Order

### Immediate (This Week):
1. **Research Phase** (4-6 hours)
   - Examine [ORE program repository](https://github.com/regolith-labs/ore) for `Automate` instruction
   - Examine [ORE CLI repository](https://github.com/regolith-labs/ore-cli) for automation implementation
   - Document account structures and PDAs (especially Automation PDA)
   - Understand how automation actually executes (on-chain vs bot)
   - Create TypeScript type definitions

2. **Build `Automate` Instruction** (4-5 hours)
   - Implement `createAutomateInstruction()` builder
   - Derive Automation PDA correctly
   - Build account list based on ORE program requirements
   - Serialize instruction data correctly
   - Test with devnet/localnet first
   - Test with small config on mainnet

3. **UI Integration** (3-4 hours)
   - Replace "Initialize" with "Setup Automation"
   - Remove deposit/withdraw UI
   - Wire up automation setup/update
   - Add automation status display
   - Add success/error feedback

### Short-term (Next Week):
4. **Manual SOL Claiming** (2-3 hours)
   - Implement `ClaimSOL` instruction
   - Research if `Checkpoint` is needed first
   - Add "Claim SOL" button to UI
   - Poll for pending SOL and display amount
   - Test SOL claiming flow end-to-end
   - **NO automatic claiming** - manual only

### Long-term (Future):
5. **Automation Integration** (1-2 weeks)
   - Research `Automate` instruction fully
   - Build automation config UI
   - Develop backend bot for automated execution

## Risks and Considerations

### Risks:
1. **Instruction Format Changes**: ORE program may update instruction formats
   - Mitigation: Version pinning, error handling, monitoring
2. **Transaction Failures**: Rounds may end before transaction confirms
   - Mitigation: Check round status before sending, handle errors gracefully
3. **Account Derivation**: PDAs may be incorrectly derived
   - Mitigation: Test thoroughly, verify against actual transactions
4. **Rate Limiting**: RPC endpoints may rate limit
   - Mitigation: Use custom RPC (Helius), implement retries with backoff

### Considerations:
1. **Transaction Size**: Multiple Deploy instructions may exceed transaction size limit
   - Solution: Split into multiple transactions if needed (max 1232 bytes)
2. **Priority Fees**: High network congestion may require priority fees
   - Solution: Add priority fee settings (Jito tips)
3. **User Experience**: Users need clear feedback on transaction status
   - Solution: Loading states, transaction links, error messages

## Success Criteria

### Phase 1 (Automation Setup):
- ✅ Users can configure automation on-chain via `Automate` instruction
- ✅ Risk profiles correctly map to EV thresholds and block counts
- ✅ Automation config stored on-chain successfully
- ✅ Users can update automation settings
- ✅ Users can enable/disable automation
- ✅ UI displays current automation status

### Phase 2 (Monitoring):
- ✅ Automation status displays correctly (active/inactive)
- ✅ Mining activity tracked and displayed
- ✅ Current round info shows correctly
- ✅ Pending rewards detected and displayed

### Phase 3 (SOL Claiming):
- ✅ Users can manually claim their SOL back via "Claim SOL" button
- ✅ Pending SOL amount displays correctly
- ✅ Claiming process is smooth and reliable
- ✅ **NO automatic claiming** - user has full control
- ✅ Transaction status and signatures displayed

## Next Steps

1. **Start with Research**: Examine [ORE repository](https://github.com/regolith-labs/ore) and [ore-cli](https://github.com/regolith-labs/ore-cli) for `Automate` instruction format
2. **Build MVP**: Get `Automate` instruction working end-to-end (automation setup)
3. **Add SOL Claiming**: Implement `ClaimSOL` instruction with manual "Claim SOL" button
4. **Test Thoroughly**: Use devnet/localnet before mainnet
5. **Iterate**: Add features based on user feedback

**Key Points:**
- ✅ Automation only - no manual mining
- ✅ Manual SOL claiming only - "Claim SOL" button, no auto-claim
- ✅ User has full control over claiming

---

**Questions to Resolve:**
1. **How does ORE's automation actually execute?**
   - Does the ORE program automatically trigger deployments based on config?
   - Or does a backend bot need to monitor and trigger the automation?
   - Reference [ore-cli](https://github.com/regolith-labs/ore-cli) to understand execution model

2. **What are the exact PDA derivations?**
   - Automation PDA derivation
   - Board, Round, Miner, Treasury PDA derivations
   - Can be found in ORE program source or ore-cli implementation

3. **Automation parameters:**
   - What parameters does `Automate` instruction accept?
   - How is EV threshold used?
   - How does it determine which squares to deploy to?
   - Reference ORE program instruction definitions

4. **SOL claiming workflow:**
   - When is `Checkpoint` needed (if at all)?
   - What is the exact flow: Checkpoint → ClaimSOL, or just ClaimSOL?
   - Can users claim SOL immediately after round ends, or is there a delay?
   - Reference [ore-cli](https://github.com/regolith-labs/ore-cli) for claim patterns

**Key Resources:**
- [ORE Program Repository](https://github.com/regolith-labs/ore) - Core program logic
- [ORE CLI Repository](https://github.com/regolith-labs/ore-cli) - Implementation examples
- Health endpoint: `https://ore-api.gmore.fun/health` - Board/Treasury pubkeys

