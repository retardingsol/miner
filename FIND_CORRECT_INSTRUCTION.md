# Finding the Correct Instruction Name

## Current Issue

Error 0x65 (InstructionFallbackNotFound) on both devnet and mainnet indicates the instruction discriminator is wrong.

**Current assumption:** Instruction name is `"automate"`  
**Current discriminator:** `546aae5e07401682`  
**Status:** ❌ Not recognized by ORE program

## Methods to Find Correct Instruction Name

### Method 1: Analyze Real Transaction (Best Option)

1. Find a successful automation transaction on Solscan/Explorer
2. Look for transactions to ORE program: `LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo`
3. Extract the instruction data
4. The first 8 bytes are the discriminator
5. Reverse-calculate the instruction name from the discriminator

**How to reverse-calculate:**
```python
import hashlib

# Known discriminator from transaction
known_discriminator = "XXXXXXXX"  # 8 bytes hex

# Try common instruction names
for name in ['automate', 'Automate', 'initialize_automation', ...]:
    preimage = f"global:{name}".encode()
    hash_bytes = hashlib.sha256(preimage).digest()
    disc = hash_bytes[:8].hex()
    if disc == known_discriminator:
        print(f"Found! Instruction name is: {name}")
```

### Method 2: Check ORE Program Source Code

1. Access the ORE program repository: https://github.com/regolith-labs/ore
2. Look for the instruction handler function
3. Find the `#[instruction]` or `pub fn` that handles automation
4. The function name is the instruction name

**Expected location:**
- `program/src/instruction/automate.rs` or similar
- `program/src/lib.rs` - look for `pub fn automate` or similar

### Method 3: Check ORE Program IDL

If the ORE program has a published IDL:
1. Find the IDL file (usually `idl/ore.json` or similar)
2. Look in the `instructions` array
3. Find the instruction that matches automation functionality
4. The `name` field is the instruction name

### Method 4: Try Common Variations

Based on Anchor framework patterns, try these:

```typescript
// Common patterns to try:
- 'automate' (current - doesn't work)
- 'Automate' (capital A)
- 'initialize_automation'
- 'InitializeAutomation'
- 'setup_automation'
- 'SetupAutomation'
- 'create_automation'
- 'CreateAutomation'
```

## Next Steps

1. ⏳ Find a real automation transaction on Solscan
2. ⏳ Extract the instruction discriminator
3. ⏳ Reverse-calculate the instruction name
4. ⏳ Update `oreDiscriminators.ts` with correct discriminator
5. ⏳ Test again

## Alternative: Check if ORE Program Uses Different Pattern

Some Anchor programs use:
- Namespace prefixes: `"namespace:instruction_name"`
- Different hashing: Not SHA256("global:name")
- Custom discriminators: Not Anchor standard

If standard Anchor pattern doesn't work, we may need to:
- Check ORE program documentation
- Contact ORE team
- Analyze multiple transactions to find pattern

