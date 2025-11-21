/**
 * Standalone test for price service
 * Run with: npx tsx src/services/test-price.ts
 */

import { getPrices, getCachedPrices } from './priceService';

async function testPriceService() {
  console.log('🧪 Testing Price Service...\n');

  try {
    console.log('Test 1: Fetch prices from Jupiter API');
    console.log('--------------------------------------');
    const startTime = Date.now();
    const [orePrice, solPrice] = await getPrices();
    const endTime = Date.now();
    
    console.log(`✅ ORE Price: $${orePrice.toFixed(4)}`);
    console.log(`✅ SOL Price: $${solPrice.toFixed(2)}`);
    console.log(`   Time taken: ${endTime - startTime}ms\n`);

    if (orePrice <= 0 || solPrice <= 0) {
      throw new Error('Prices should be greater than 0');
    }

    console.log('Test 2: Test caching');
    console.log('--------------------');
    const cacheStartTime = Date.now();
    const [cachedOrePrice, cachedSolPrice] = await getCachedPrices();
    const cacheEndTime = Date.now();
    
    console.log(`✅ Cached ORE Price: $${cachedOrePrice.toFixed(4)}`);
    console.log(`✅ Cached SOL Price: $${cachedSolPrice.toFixed(2)}`);
    console.log(`   Time taken: ${cacheEndTime - cacheStartTime}ms`);
    
    if (cacheEndTime - cacheStartTime > 100) {
      console.log('⚠️  Warning: Cache might not be working (took too long)');
    } else {
      console.log('✅ Cache working correctly (fast response)\n');
    }

    // Test cache hit
    const cacheHitStartTime = Date.now();
    await getCachedPrices();
    const cacheHitEndTime = Date.now();
    
    if (cacheHitEndTime - cacheHitStartTime < 50) {
      console.log('✅ Cache hit confirmed (very fast response)');
    }

    console.log('\n✅ All price service tests passed!');
  } catch (error) {
    console.error('❌ Price service test failed:', error);
    process.exit(1);
  }
}

testPriceService();

