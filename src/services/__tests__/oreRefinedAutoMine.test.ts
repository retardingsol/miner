/**
 * Test file for ORE Refined Auto-Mining
 * 
 * This file tests the auto-mining service to ensure it works correctly
 * before integrating into the UI
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { getPrices, getCachedPrices } from '../priceService';
import { createAutoMineController } from '../oreRefinedAutoMine';

// Mock dependencies
vi.mock('../api', () => ({
  getState: vi.fn(),
}));

describe('Price Service', () => {
  it('should fetch prices from Jupiter API', async () => {
    const [orePrice, solPrice] = await getPrices();
    
    expect(orePrice).toBeGreaterThan(0);
    expect(solPrice).toBeGreaterThan(0);
    expect(typeof orePrice).toBe('number');
    expect(typeof solPrice).toBe('number');
  }, 10000); // 10 second timeout for API call

  it('should cache prices', async () => {
    // Clear cache
    const firstCall = await getCachedPrices();
    
    // Second call should be fast (cached)
    const startTime = Date.now();
    const secondCall = await getCachedPrices();
    const endTime = Date.now();
    
    expect(secondCall).toEqual(firstCall);
    expect(endTime - startTime).toBeLessThan(100); // Should be very fast (< 100ms)
  });
});

describe('Auto Mine Controller', () => {
  let connection: Connection;
  let signer: PublicKey;
  let signTransaction: any;

  beforeEach(() => {
    connection = new Connection('https://api.mainnet-beta.solana.com');
    signer = Keypair.generate().publicKey;
    signTransaction = vi.fn().mockResolvedValue({
      serialize: () => Buffer.from([]),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create controller with correct config', () => {
    const controller = createAutoMineController({
      connection,
      signer,
      signTransaction,
      perRoundDeployAmount: 0.1,
      remainingSlots: 15,
      oreRefinedRate: 1.3,
    });

    expect(controller).toBeDefined();
    expect(typeof controller.start).toBe('function');
    expect(typeof controller.stop).toBe('function');
    expect(typeof controller.getStatus).toBe('function');
  });

  it('should return initial status', () => {
    const controller = createAutoMineController({
      connection,
      signer,
      signTransaction,
      perRoundDeployAmount: 0.1,
      remainingSlots: 15,
      oreRefinedRate: 1.3,
    });

    const status = controller.getStatus();
    expect(status.isRunning).toBe(false);
    expect(status.roundId).toBeNull();
    expect(status.slotLeft).toBeNull();
  });
});

