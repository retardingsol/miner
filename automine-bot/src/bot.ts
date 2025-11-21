import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { getCurrentRound } from './oreState.js';
import { getSession, listSessions, updateSessionStatus, findBurner } from './state.js';
import type { SessionConfig, BotContext } from './types.js';

// NOTE: This is a minimal, conservative bot loop.
// It focuses on structure; you should harden transaction logic and error handling
// before running with real SOL on mainnet.

const LAMPORTS_PER_SOL = 1_000_000_000n;

export class AutoMineBot {
  private ctx: BotContext;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(ctx: BotContext) {
    this.ctx = ctx;
  }

  start() {
    if (this.intervalId) return;
    // Tick every 2 seconds
    this.intervalId = setInterval(() => {
      void this.tick();
    }, 2000);
    console.log('⛏️  AutoMine bot started');
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⛏️  AutoMine bot stopped');
    }
  }

  private async tick() {
    const active = listSessions().filter((s) => s.status === 'running');
    if (!active.length) return;

    let oreState;
    try {
      oreState = await getCurrentRound(this.ctx.connection);
    } catch (e) {
      console.error('Failed to fetch ORE state:', e);
      return;
    }

    if (!oreState || oreState.status !== 'active') return;

    for (const session of active) {
      try {
        await this.handleSession(session, oreState.roundId);
      } catch (e) {
        console.error(`Error processing session ${session.sessionId}:`, e);
        updateSessionStatus(session.sessionId, 'error', {
          lastError: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  private async handleSession(session: SessionConfig, currentRoundId: number) {
    if (session.roundsCompleted >= session.rounds) {
      updateSessionStatus(session.sessionId, 'completed');
      return;
    }

    if (session.remainingSolLamports <= 0n) {
      updateSessionStatus(session.sessionId, 'completed');
      return;
    }

    // Simple strategy: deploy solPerBlock × blocks for the current round
    const deployAmountLamports = session.solPerBlockLamports * BigInt(session.blocks);

    if (deployAmountLamports > session.remainingSolLamports) {
      // Not enough remaining SOL; mark completed
      updateSessionStatus(session.sessionId, 'completed', {
        lastError: 'Insufficient remaining SOL for configured deployment',
      });
      return;
    }

    const burnerRecord = findBurner(session.mainWallet);
    if (!burnerRecord) {
      updateSessionStatus(session.sessionId, 'error', {
        lastError: 'Burner not found for main wallet',
      });
      return;
    }

    const burnerKeypair = Keypair.fromSecretKey(bs58.decode(burnerRecord.burnerSecretBase58));

    // TODO: Replace this placeholder with real ORE Deploy / Refined tx
    // For now, we just send a no-op SystemProgram.transfer of 0 lamports to self
    // so the pipeline structure is complete without risking funds.
    const { blockhash, lastValidBlockHeight } = await this.ctx.connection.getLatestBlockhash(
      'confirmed',
    );

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: burnerKeypair.publicKey,
        toPubkey: burnerKeypair.publicKey,
        lamports: 0,
      }),
    );

    tx.recentBlockhash = blockhash;
    tx.feePayer = burnerKeypair.publicKey;
    tx.sign(burnerKeypair);

    const signature = await this.ctx.connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });

    await this.ctx.connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed',
    );

    const remaining = session.remainingSolLamports - deployAmountLamports;
    const deployed = session.totalDeployedLamports + deployAmountLamports;

    updateSessionStatus(session.sessionId, 'running', {
      remainingSolLamports: remaining,
      totalDeployedLamports: deployed,
      roundsCompleted: session.roundsCompleted + 1,
      lastRoundId: currentRoundId,
      lastTxSig: signature,
      lastError: null,
    });

    console.log(
      `Session ${session.sessionId}: deployed ${(deployAmountLamports / LAMPORTS_PER_SOL).toString()} SOL for round ${currentRoundId}`,
    );
  }
}


