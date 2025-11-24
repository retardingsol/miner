import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getCurrentRound } from './oreState.js';
import { createDeployInstruction, ORE_PROGRAM_ID } from './oreProgram.js';
import BN from 'bn.js';

const LAMPORTS_PER_SOL = 1_000_000_000n;

interface AutomationAccount {
  amount: bigint;
  authority: PublicKey;
  balance: bigint;
  executor: PublicKey;
  fee: bigint;
  strategy: bigint;
  mask: bigint;
}

function parseAutomationAccount(data: Buffer): AutomationAccount | null {
  if (data.length < 8 + 8 + 32 + 8 + 32 + 8 + 8 + 8) {
    console.warn('Automation account data too short:', data.length);
    return null;
  }

  let offset = 8; // skip discriminator
  const amount = BigInt(new BN(data.slice(offset, offset + 8), 'le').toString());
  offset += 8;
  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const balance = BigInt(new BN(data.slice(offset, offset + 8), 'le').toString());
  offset += 8;
  const executor = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  const fee = BigInt(new BN(data.slice(offset, offset + 8), 'le').toString());
  offset += 8;
  const strategy = BigInt(new BN(data.slice(offset, offset + 8), 'le').toString());
  offset += 8;
  const mask = BigInt(new BN(data.slice(offset, offset + 8), 'le').toString());

  return { amount, authority, balance, executor, fee, strategy, mask };
}

async function main() {
  const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
  const secretBase58 = process.env.EXECUTOR_SECRET_BASE58;

  if (!secretBase58) {
    console.error('Missing EXECUTOR_SECRET_BASE58 env var');
    process.exit(1);
  }

  const executorKeypair = Keypair.fromSecretKey(bs58.decode(secretBase58));
  const connection = new Connection(rpcUrl, 'confirmed');

  console.log('🔁 Executor bot starting');
  console.log('RPC URL:', rpcUrl);
  console.log('Executor:', executorKeypair.publicKey.toBase58());

  async function tick() {
    let oreState;
    try {
      oreState = await getCurrentRound(connection);
    } catch (e) {
      console.error('Failed to fetch ORE state:', e);
      return;
    }

    if (!oreState || oreState.status !== 'active') {
      return;
    }

    // Discover all Automation accounts that use this executor.
    // Automation struct layout (including 8-byte discriminator):
    // offset 0:  discriminator [u8;8]
    // offset 8:  amount u64
    // offset 16: authority Pubkey
    // offset 48: balance u64
    // offset 56: executor Pubkey  <-- we filter on this
    const accounts = await connection.getProgramAccounts(ORE_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 56,
            bytes: executorKeypair.publicKey.toBase58(),
          },
        },
      ],
    });

    if (!accounts.length) return;

    const currentRoundId =
      typeof oreState.roundId === 'number'
        ? oreState.roundId
        : Number(oreState.roundId);

    for (const { pubkey, account } of accounts) {
      try {
        const automation = parseAutomationAccount(account.data);
        if (!automation) continue;

        // Ignore automations with no usable balance
        if (automation.balance <= BigInt(0)) continue;
        if (automation.balance < automation.amount + automation.fee) continue;

        const authority = automation.authority;

        // For automation, deploy.rs uses automation.amount and automation.strategy/mask.
        const squares: boolean[] = Array(25)
          .fill(false)
          .map((_, i) => i < 25);

        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash('confirmed');

        const deployIx = createDeployInstruction({
          signer: executorKeypair.publicKey,
          authority,
          amountLamports: automation.amount,
          roundId: currentRoundId,
          squares,
        });

        const tx = new Transaction().add(deployIx);
        tx.recentBlockhash = blockhash;
        tx.feePayer = executorKeypair.publicKey;
        tx.sign(executorKeypair);

        const signature = await connection.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
          maxRetries: 3,
        });

        await connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          'confirmed',
        );

        console.log(
          `✅ Deployed automation for authority ${authority.toBase58()} via automation ${pubkey.toBase58()} on round ${currentRoundId}. Tx: ${signature}`,
        );
      } catch (e) {
        console.error('Error handling automation account', pubkey.toBase58(), e);
      }
    }
  }

  // Run immediately, then every 2 seconds.
  await tick();
  setInterval(() => {
    void tick();
  }, 2000);
}

main().catch((err) => {
  console.error('Fatal error in executor bot:', err);
  process.exit(1);
});


