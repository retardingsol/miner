import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { createHash } from 'crypto';
import { AutoMineBot } from './bot.js';
import {
  getOrCreateBurner,
  findBurner,
  createSession,
  getSession,
  updateSessionStatus,
} from './state.js';
import type { BotContext, SessionConfig } from './types.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Secret used to derive burner wallets deterministically from a main wallet.
// This ensures that redeploying the bot (or restarting the process) does NOT
// change the burner linked to a given main wallet.
const BURNER_DERIVATION_SECRET =
  process.env.AUTOMINE_BURNER_SECRET || 'dev-automine-secret';

function deriveDeterministicBurner(mainWallet: string): Keypair {
  // Derive a 32-byte seed from (secret || mainWallet) using SHA-256.
  // As long as BURNER_DERIVATION_SECRET is stable, the same mainWallet will
  // always map to the same burner keypair across deployments.
  const hash = createHash('sha256')
    .update(BURNER_DERIVATION_SECRET)
    .update(':')
    .update(mainWallet)
    .digest();
  const seed = hash.subarray(0, 32);
  return Keypair.fromSeed(seed);
}

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const connection = new Connection(RPC_URL, 'confirmed');
  const oreProgramId = new PublicKey('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo');

  const ctx: BotContext = {
    rpcUrl: RPC_URL,
    connection,
    oreProgramId,
  };

  const bot = new AutoMineBot(ctx);
  bot.start();

  const toApiSession = (session: SessionConfig | undefined) => {
    if (!session) return null;
    return {
      ...session,
      solPerBlockLamports: Number(session.solPerBlockLamports),
      remainingSolLamports:
        session.remainingSolLamports !== undefined
          ? Number(session.remainingSolLamports)
          : undefined,
      totalDeployedLamports:
        session.totalDeployedLamports !== undefined
          ? Number(session.totalDeployedLamports)
          : undefined,
    };
  };

  // POST /automine/burner { mainWallet }
  app.post('/automine/burner', (req, res) => {
    const { mainWallet } = req.body ?? {};
    if (!mainWallet || typeof mainWallet !== 'string') {
      return res.status(400).json({ error: 'mainWallet is required' });
    }

    let burner = findBurner(mainWallet);
    if (!burner) {
      const keypair = deriveDeterministicBurner(mainWallet);
      const burnerSecretBase58 = bs58.encode(keypair.secretKey);
      burner = getOrCreateBurner(
        mainWallet,
        keypair.publicKey.toBase58(),
        burnerSecretBase58,
      );
      console.log(
        `Created deterministic burner for ${mainWallet}: ${burner.burnerAddress}`,
      );
    }

    res.json({
      mainWallet: burner.mainWallet,
      burnerAddress: burner.burnerAddress,
    });
  });

  // POST /automine/sessions { mainWallet, solPerBlock, blocks, rounds }
  app.post('/automine/sessions', (req, res) => {
    const { mainWallet, solPerBlock, blocks, rounds } = req.body ?? {};
    if (!mainWallet || typeof mainWallet !== 'string') {
      return res.status(400).json({ error: 'mainWallet is required' });
    }
    if (typeof solPerBlock !== 'number' || solPerBlock <= 0) {
      return res.status(400).json({ error: 'solPerBlock must be > 0' });
    }
    if (typeof blocks !== 'number' || blocks <= 0 || blocks > 25) {
      return res.status(400).json({ error: 'blocks must be between 1 and 25' });
    }
    if (typeof rounds !== 'number' || rounds <= 0) {
      return res.status(400).json({ error: 'rounds must be > 0' });
    }

    const burner = findBurner(mainWallet);
    if (!burner) {
      return res
        .status(400)
        .json({ error: 'Burner not found for mainWallet. Call /automine/burner first.' });
    }

    try {
      const solPerBlockLamports = BigInt(
        Math.floor(solPerBlock * 1_000_000_000),
      );
      const initialDepositLamports =
        solPerBlockLamports * BigInt(blocks) * BigInt(rounds);

      const session = createSession({
        mainWallet,
        burnerAddress: burner.burnerAddress,
        solPerBlockLamports,
        blocks,
        rounds,
        initialDepositLamports,
      });

      res.json(toApiSession(session));
    } catch (e) {
      if (
        e instanceof Error &&
        e.message.includes('Active automine session already exists')
      ) {
        return res.status(400).json({ error: e.message });
      }
      console.error('Error creating session:', e);
      return res.status(500).json({
        error: 'Failed to create automine session',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // POST /automine/sessions/:id/start
  app.post('/automine/sessions/:id/start', (req, res) => {
    const sessionId = req.params.id;
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const updated = updateSessionStatus(sessionId, 'running');
    res.json(toApiSession(updated));
  });

  // POST /automine/sessions/:id/stop
  app.post('/automine/sessions/:id/stop', (req, res) => {
    const sessionId = req.params.id;
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const updated = updateSessionStatus(sessionId, 'stopped');
    res.json(toApiSession(updated));
  });

  // GET /automine/sessions/:id
  app.get('/automine/sessions/:id', (req, res) => {
    const sessionId = req.params.id;
    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(toApiSession(session));
  });

  app.get('/health', async (_req, res) => {
    try {
      const slot = await connection.getSlot('confirmed');
      res.json({ ok: true, slot, rpcUrl: RPC_URL });
    } catch (e) {
      res.status(500).json({ ok: false, error: (e as Error).message });
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 Automine bot listening on port ${PORT}`);
  });
}

void main();


