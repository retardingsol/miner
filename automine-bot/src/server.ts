import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
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
      const keypair = Keypair.generate();
      const burnerSecretBase58 = bs58.encode(keypair.secretKey);
      burner = getOrCreateBurner(mainWallet, keypair.publicKey.toBase58(), burnerSecretBase58);
      console.log(`Created burner for ${mainWallet}: ${burner.burnerAddress}`);
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
      return res.status(400).json({ error: 'Burner not found for mainWallet. Call /automine/burner first.' });
    }

    const solPerBlockLamports = BigInt(Math.floor(solPerBlock * 1_000_000_000));
    const initialDepositLamports = solPerBlockLamports * BigInt(blocks) * BigInt(rounds);

    const session = createSession({
      mainWallet,
      burnerAddress: burner.burnerAddress,
      solPerBlockLamports,
      blocks,
      rounds,
      initialDepositLamports,
    });

    res.json(toApiSession(session));
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


