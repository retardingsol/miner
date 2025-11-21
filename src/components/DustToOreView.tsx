import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, LAMPORTS_PER_SOL, SystemProgram } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  createCloseAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { SolanaLogo } from './SolanaLogo';

interface TokenAccount {
  mint: string;
  address: string;
  balance: number;
  decimals: number;
  uiAmount: number;
  name?: string;
  symbol?: string;
}

interface DustToken extends TokenAccount {
  estimatedORE: number;
  estimatedUSD: number;
  worthConverting: boolean;
  logoURI?: string;
}

const ORE_MINT = new PublicKey('oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp');
const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const JUPITER_API_BASE = 'https://quote-api.jup.ag/v6';
const JUPITER_TOKEN_LIST = 'https://token.jup.ag/all';
const RENT_RECLAIM_FEE_ADDRESS = new PublicKey('3copeQ922WcSc5uqZbESgZ3TrfnEA8UEGHJ4EvkPAtHS');

// Maximum USD value to consider for auto-conversion (< $10)
const MAX_DUST_VALUE_USD = 10;
// Minimum value in SOL to consider worth converting (0.001 SOL = ~$0.10)
const MIN_DUST_VALUE_SOL = 0.001;

export function DustToOreView() {
  const { publicKey, connected, connecting, signTransaction } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  
  const [dustTokens, setDustTokens] = useState<DustToken[]>([]);
  const [emptyAccounts, setEmptyAccounts] = useState<{ address: string; rent: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingQuotes, setLoadingQuotes] = useState<Set<string>>(new Set());
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientBalance, setInsufficientBalance] = useState<{ current: number; required: number } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [orePrice, setOrePrice] = useState<number | null>(null);
  const [tokenMetadataCache, setTokenMetadataCache] = useState<Map<string, { name: string; symbol: string; logoURI?: string }>>(new Map());

  // Fetch prices
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Fetch SOL and ORE prices from a price API or your own API
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const data = await response.json();
        if (data.solana?.usd) {
          setSolPrice(data.solana.usd);
        }
        
        // Try to get ORE price from your API or another source
        // For now, we'll use a placeholder - you can update this
        const oreResponse = await fetch('https://ore-api.gmore.fun/v2/state');
        const oreData = await oreResponse.json();
        // New v2 API format: globals.orePrice.priceUsdRaw
        const orePriceRaw = oreData.globals?.orePrice?.priceUsdRaw;
        if (orePriceRaw) {
          setOrePrice(parseFloat(orePriceRaw));
        }
      } catch (err) {
        console.error('Error fetching prices:', err);
      }
    };
    
    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Helper function to retry fetch with exponential backoff on 429
  const fetchWithRetry = async (url: string, retries = 3, delay = 500): Promise<Response | null> => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url);
        if (response.status === 429) {
          // Rate limited - wait and retry
          const retryDelay = delay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
        return response;
      } catch (err) {
        if (i === retries - 1) {
          console.warn(`Failed to fetch ${url} after ${retries} retries:`, err);
          return null;
        }
        const retryDelay = delay * Math.pow(2, i);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return null;
  };

  // Fetch token metadata from Jupiter token list (load once and cache)
  useEffect(() => {
    let cancelled = false;
    
    const loadTokenList = async () => {
      try {
        const response = await fetch(JUPITER_TOKEN_LIST);
        if (!response.ok || cancelled) return;

        const tokens = await response.json();
        const metadataMap = new Map<string, { name: string; symbol: string; logoURI?: string }>();
        
        tokens.forEach((token: any) => {
          if (token.address) {
            // Use symbol as fallback for name if name is missing
            const symbol = token.symbol || token.address.slice(0, 4).toUpperCase();
            const name = token.name || symbol;
            metadataMap.set(token.address, {
              name,
              symbol,
              logoURI: token.logoURI,
            });
          }
        });
        
        if (!cancelled) {
          setTokenMetadataCache(metadataMap);
        }
      } catch (err) {
        console.warn('Failed to load token list:', err);
      }
    };
    
    loadTokenList();
    
    return () => {
      cancelled = true;
    };
  }, []);

  // Get token metadata from cache
  const getTokenMetadata = useCallback((mint: string): { name: string; symbol: string; logoURI?: string } | null => {
    return tokenMetadataCache.get(mint) || null;
  }, [tokenMetadataCache]);

  // Check if error is a user cancellation
  const isUserCancellation = (error: any): boolean => {
    const errorMessage = error?.message || String(error || '').toLowerCase();
    return (
      errorMessage.includes('user rejected') ||
      errorMessage.includes('user cancelled') ||
      errorMessage.includes('user canceled') ||
      errorMessage.includes('cancelled') ||
      errorMessage.includes('canceled') ||
      errorMessage.includes('4001') || // Phantom rejection code
      errorMessage.includes('denied')
    );
  };


  // Scan for dust tokens and empty accounts
  const scanWallet = useCallback(async () => {
    if (!connected || !publicKey || !connection) {
      setDustTokens([]);
      setEmptyAccounts([]);
      setLoadingQuotes(new Set());
      return;
    }

    setLoading(true);
    setError(null);
    setInsufficientBalance(null);
    setDustTokens([]);
    setEmptyAccounts([]);
    setLoadingQuotes(new Set());
    
    // Fetch quote for a single token (defined here to access state setters)
    const fetchTokenQuote = async (mint: string, amount: string, address: string) => {
      setLoadingQuotes(prev => new Set(prev).add(address));
      
      try {
        // Add delay between requests to reduce rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
        let estimatedORE = 0;
        let estimatedUSD = 0;
        let worthConverting = false;
        
        // Get quote to ORE to estimate conversion
        const quoteUrl = `${JUPITER_API_BASE}/quote?inputMint=${mint}&outputMint=${ORE_MINT.toBase58()}&amount=${amount}&slippageBps=50`;
        const quoteResponse = await fetchWithRetry(quoteUrl);
        
        if (quoteResponse?.ok) {
          const quote = await quoteResponse.json();
          if (quote.outAmount) {
            // Convert to ORE (ORE has 9 decimals)
            estimatedORE = parseInt(quote.outAmount) / 1e9;
            
            // Also get quote to SOL to estimate USD value
            await new Promise(resolve => setTimeout(resolve, 200)); // Delay between requests
            
            const solQuoteUrl = `${JUPITER_API_BASE}/quote?inputMint=${mint}&outputMint=${SOL_MINT.toBase58()}&amount=${amount}&slippageBps=50`;
            const solQuoteResponse = await fetchWithRetry(solQuoteUrl);
            
            if (solQuoteResponse?.ok) {
              const solQuote = await solQuoteResponse.json();
              if (solQuote.outAmount) {
                const estimatedSOL = parseInt(solQuote.outAmount) / LAMPORTS_PER_SOL;
                // Estimate USD value based on SOL price
                estimatedUSD = estimatedSOL * (solPrice || 100);
              }
            } else {
              // Fallback: use ORE price if SOL quote fails
              estimatedUSD = estimatedORE * (orePrice || 0);
            }
            
            // Worth converting if:
            // 1. Estimated value >= minimum threshold ($0.10), OR
            // 2. Estimated value < $10 (small dust tokens)
            const meetsMinThreshold = estimatedUSD >= (MIN_DUST_VALUE_SOL * (solPrice || 100));
            const isSmallDust = estimatedUSD > 0 && estimatedUSD < MAX_DUST_VALUE_USD;
            
            worthConverting = meetsMinThreshold || isSmallDust;
          }
        }
        
        // Update this specific token in the state
        setDustTokens(prev => prev.map(token => 
          token.address === address 
            ? { ...token, estimatedORE, estimatedUSD, worthConverting }
            : token
        ));
      } catch (err) {
        console.warn(`Failed to get quote for ${mint}:`, err);
      } finally {
        setLoadingQuotes(prev => {
          const next = new Set(prev);
          next.delete(address);
          return next;
        });
      }
    };
    
    try {
      setLoadingStatus('Fetching token accounts...');
      // Get all token accounts
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      });

      setLoadingStatus(`Analyzing ${tokenAccounts.value.length} token accounts...`);
      const dust: DustToken[] = [];
      const empty: { address: string; rent: number }[] = [];
      const tokensNeedingQuotes: Array<{ mint: string; amount: string; address: string }> = [];

      // First pass: Process all accounts and identify empty accounts and tokens
      for (const accountInfo of tokenAccounts.value) {
        const parsedInfo = accountInfo.account.data.parsed.info;
        const mint = parsedInfo.mint;
        const tokenAmount = parsedInfo.tokenAmount;
        
        // Skip ORE token itself
        if (mint === ORE_MINT.toBase58()) {
          continue;
        }

        const uiAmount = tokenAmount.uiAmount || 0;
        
        // Check if account is empty (can be closed)
        if (uiAmount === 0) {
          try {
            await getAccount(connection, new PublicKey(accountInfo.pubkey));
            // Estimate rent (roughly 0.0018 SOL per token account)
            empty.push({
              address: accountInfo.pubkey.toBase58(),
              rent: 0.0018,
            });
          } catch (err) {
            // Account might already be closed or doesn't exist
          }
          continue;
        }

        // Add token with basic info immediately (without quotes)
        const tokenAddress = accountInfo.pubkey.toBase58();
        
        // Get token metadata from cache
        const metadata = getTokenMetadata(mint);
        
        // Fallback logic: use symbol for name, mint address for symbol if not available
        const symbol = metadata?.symbol || mint.slice(0, 4).toUpperCase();
        const name = metadata?.name || symbol;
        
        dust.push({
          mint,
          address: tokenAddress,
          balance: parseInt(tokenAmount.amount),
          decimals: tokenAmount.decimals,
          uiAmount,
          name,
          symbol,
          logoURI: metadata?.logoURI,
          estimatedORE: 0,
          estimatedUSD: 0,
          worthConverting: false,
        });

        // Queue this token for quote fetching
        tokensNeedingQuotes.push({
          mint,
          amount: tokenAmount.amount,
          address: tokenAddress,
        });
      }

      // Display empty accounts immediately
      setEmptyAccounts(empty);
      
      // Display tokens immediately with basic info
      setDustTokens(dust);
      
      setLoadingStatus(`Found ${empty.length} empty account${empty.length !== 1 ? 's' : ''} and ${dust.length} dust token${dust.length !== 1 ? 's' : ''}${tokensNeedingQuotes.length > 0 ? `. Fetching prices...` : ''}`);
      
      // Mark loading as complete for accounts scan (quotes will load progressively)
      if (tokensNeedingQuotes.length > 0) {
        // Keep loading state true while fetching quotes
      } else {
        setLoading(false);
        setLoadingStatus('');
      }
      
      // Fetch quotes for all tokens in parallel with delays
      // Process in batches of 3 to avoid rate limiting
      const batchSize = 3;
      for (let i = 0; i < tokensNeedingQuotes.length; i += batchSize) {
        const batch = tokensNeedingQuotes.slice(i, i + batchSize);
        const currentBatch = Math.floor(i / batchSize) + 1;
        const totalBatches = Math.ceil(tokensNeedingQuotes.length / batchSize);
        
        if (tokensNeedingQuotes.length > batchSize) {
          setLoadingStatus(`Fetching prices... (Batch ${currentBatch}/${totalBatches})`);
        }
        
        await Promise.all(
          batch.map((token, index) => 
            new Promise(resolve => 
              setTimeout(() => {
                fetchTokenQuote(token.mint, token.amount, token.address).then(resolve);
              }, index * 300) // Stagger requests within batch
            )
          )
        );
        // Delay between batches
        if (i + batchSize < tokensNeedingQuotes.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Mark loading as complete
      setLoading(false);
      setLoadingStatus('');
    } catch (err) {
      console.error('Error scanning wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to scan wallet');
      setLoading(false);
      setLoadingStatus('');
    }
  }, [connected, publicKey, connection, solPrice, orePrice, getTokenMetadata]);

  // Auto-scan when wallet connects
  useEffect(() => {
    if (connected && publicKey) {
      scanWallet();
    } else {
      setDustTokens([]);
      setEmptyAccounts([]);
    }
  }, [connected, publicKey, scanWallet]);

  // Convert dust to ORE via Jupiter
  const convertDustToOre = useCallback(async (tokens: DustToken[]) => {
    if (!connected || !publicKey || !connection) {
      setError('Please connect your wallet');
      return;
    }

    setConverting(true);
    setError(null);
    setInsufficientBalance(null);
    setSuccess(null);

    if (!signTransaction) {
      setError('Wallet not ready. Please connect your wallet.');
      setConverting(false);
      return;
    }

    try {
      // For each token, get swap transaction from Jupiter
      let successCount = 0;
      let failCount = 0;

      for (const token of tokens) {
        try {
          // Get swap quote and transaction from Jupiter
          const quoteUrl = `${JUPITER_API_BASE}/quote?inputMint=${token.mint}&outputMint=${ORE_MINT.toBase58()}&amount=${token.balance}&slippageBps=100`;
          const quoteResponse = await fetch(quoteUrl);
          
          if (!quoteResponse.ok) {
            console.warn(`Failed to get quote for ${token.mint}`);
            failCount++;
            continue;
          }

          const quote = await quoteResponse.json();
          
          // Get swap transaction from Jupiter
          const swapResponse = await fetch(`${JUPITER_API_BASE}/swap`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              quoteResponse: quote,
              userPublicKey: publicKey!.toBase58(),
              wrapAndUnwrapSol: true,
              dynamicComputeUnitLimit: true,
              prioritizationFeeLamports: 'auto',
            }),
          });

          if (!swapResponse.ok) {
            const errorData = await swapResponse.json().catch(() => ({}));
            console.warn(`Failed to get swap transaction for ${token.mint}:`, errorData);
            failCount++;
            continue;
          }

          const { swapTransaction } = await swapResponse.json();
          
          // Deserialize and send transaction
          const transactionBuf = Buffer.from(swapTransaction, 'base64');
          const transaction = Transaction.from(transactionBuf);
          
          // Sign and send
          const signed = await signTransaction(transaction);
          const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
          
          // Wait for confirmation
          await connection.confirmTransaction(signature, 'confirmed');
          
          successCount++;
        } catch (err) {
          console.error(`Error processing token ${token.mint}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        setSuccess(`Successfully converted ${successCount} token${successCount > 1 ? 's' : ''} to ORE!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
        // Refresh dust tokens
        setTimeout(() => scanWallet(), 2000);
      } else {
        setError(`Failed to convert tokens${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      }
    } catch (err) {
      console.error('Error converting dust:', err);
      setError(err instanceof Error ? err.message : 'Failed to convert dust to ORE');
    } finally {
      setConverting(false);
    }
  }, [connected, publicKey, connection, scanWallet, signTransaction]);

  // Close empty accounts to reclaim SOL
  const closeEmptyAccounts = useCallback(async () => {
    if (!connected || !publicKey || !connection || emptyAccounts.length === 0) {
      return;
    }

    if (!signTransaction) {
      setError('Wallet not ready. Please connect your wallet.');
      return;
    }

    setConverting(true);
    setError(null);
    setInsufficientBalance(null);
    setSuccess(null);

    try {
      // Prepare all close instructions first
      const instructions: Array<{ instruction: any; rent: number; address: string }> = [];

      for (const account of emptyAccounts) {
        try {
          const accountPubkey = new PublicKey(account.address);
          
          // Get token account info to find the owner
          const accountInfo = await connection.getAccountInfo(accountPubkey);
          if (!accountInfo) continue;
          
          try {
            const closeInstruction = createCloseAccountInstruction(
              accountPubkey,
              publicKey, // Destination for rent
              publicKey, // Owner (token account owner)
              []
            );
            instructions.push({
              instruction: closeInstruction,
              rent: account.rent,
              address: account.address,
            });
          } catch (err) {
            // Account might have a different owner - skip it
            console.warn(`Skipping account ${account.address}:`, err);
          }
        } catch (err) {
          console.error(`Error creating close instruction for ${account.address}:`, err);
        }
      }

      if (instructions.length === 0) {
        setError('No accounts could be closed (may have different owners)');
        setConverting(false);
        return;
      }

      // Calculate total rent that will be reclaimed
      const totalRent = instructions.reduce((sum, inst) => sum + inst.rent, 0);
      const totalFee = totalRent * 0.1; // 10% fee
      const totalFeeLamports = Math.floor(totalFee * LAMPORTS_PER_SOL);
      
      // Check if user has enough SOL balance for the fee + transaction costs
      // User needs: 10% fee + ~0.0001 SOL for transaction fees
      // Plus we need to ensure they have enough after the fee transfer (minimum rent exemption for wallet is ~0.00089 SOL)
      const minBalanceAfterTransaction = 0.0009; // Slightly above rent exemption minimum
      const requiredBalance = totalFee + 0.0001 + minBalanceAfterTransaction;
      const currentBalance = await connection.getBalance(publicKey);
      const currentBalanceSOL = currentBalance / LAMPORTS_PER_SOL;
      
      // Calculate balance after rent is reclaimed
      const balanceAfterReclaim = currentBalanceSOL + totalRent;
      const balanceAfterFee = balanceAfterReclaim - totalFee - 0.0001; // Account for transaction fees
      
      if (currentBalanceSOL < requiredBalance || balanceAfterFee < minBalanceAfterTransaction) {
        setInsufficientBalance({
          current: currentBalanceSOL,
          required: minBalanceAfterTransaction,
        });
        setConverting(false);
        return;
      }
      
      // Clear insufficient balance if we have enough
      setInsufficientBalance(null);

      // Batch instructions dynamically - add as many as possible up to transaction size limit (1232 bytes)
      let totalClosed = 0;
      const TRANSACTION_SIZE_LIMIT = 1232; // Solana transaction size limit in bytes
      const SAFETY_MARGIN = 20; // Safety margin to account for serialization differences
      const EFFECTIVE_LIMIT = TRANSACTION_SIZE_LIMIT - SAFETY_MARGIN; // 1212 bytes
      
      let instructionIndex = 0;
      while (instructionIndex < instructions.length) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        
        // Get current balance (includes rent from previous batches if any)
        const balanceBeforeBatch = await connection.getBalance(publicKey);
        const balanceBeforeBatchSOL = balanceBeforeBatch / LAMPORTS_PER_SOL;
        
        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;
        
        let batchRent = 0;
        let batchCount = 0;

        // Add close account instructions until we reach the size limit
        while (instructionIndex < instructions.length) {
          const { instruction, rent } = instructions[instructionIndex];
          const testTransaction = transaction.instructions.length > 0 
            ? Transaction.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }))
            : new Transaction();
          testTransaction.recentBlockhash = blockhash;
          testTransaction.feePayer = publicKey;
          
          // Add all current instructions
          for (const inst of transaction.instructions) {
            testTransaction.add(inst);
          }
          
          // Add the new instruction
          testTransaction.add(instruction);
          
          // Check if adding fee transfer would fit (only on last batch)
          let wouldAddFee = false;
          if (instructionIndex + 1 >= instructions.length && totalFeeLamports > 0) {
            const balanceAfterBatchRent = balanceBeforeBatchSOL + batchRent + rent;
            const estimatedTxFee = 0.0001;
            const feeAmountSOL = totalFeeLamports / LAMPORTS_PER_SOL;
            const balanceAfterFeeAndCosts = balanceAfterBatchRent - feeAmountSOL - estimatedTxFee;
            
            if (balanceAfterFeeAndCosts >= minBalanceAfterTransaction) {
              testTransaction.add(
                SystemProgram.transfer({
                  fromPubkey: publicKey,
                  toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                  lamports: totalFeeLamports,
                })
              );
              wouldAddFee = true;
            }
          }
          
          // Check transaction size with safety margin
          const serialized = testTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
          if (serialized.length >= EFFECTIVE_LIMIT) {
            // This instruction won't fit, break and send current batch
            break;
          }
          
          // It fits, add it to the transaction
          transaction.add(instruction);
          batchRent += rent;
          batchCount++;
          instructionIndex++;
          
          // If we're adding the fee, this is the last instruction in the batch
          if (wouldAddFee) {
            transaction.add(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                lamports: totalFeeLamports,
              })
            );
            break;
          }
        }
        
        // If this is the last batch and we haven't added the fee yet, try to add it
        if (instructionIndex >= instructions.length && totalFeeLamports > 0 && !transaction.instructions.some(inst => inst.programId.equals(SystemProgram.programId) && inst.keys.some(key => key.pubkey.equals(RENT_RECLAIM_FEE_ADDRESS)))) {
          const balanceAfterBatchRent = balanceBeforeBatchSOL + batchRent;
          const estimatedTxFee = 0.0001;
          const feeAmountSOL = totalFeeLamports / LAMPORTS_PER_SOL;
          const balanceAfterFeeAndCosts = balanceAfterBatchRent - feeAmountSOL - estimatedTxFee;
          
          if (balanceAfterFeeAndCosts >= minBalanceAfterTransaction) {
            const testTransaction = Transaction.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }));
            testTransaction.add(
              SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                lamports: totalFeeLamports,
              })
            );
            
            const serialized = testTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
            if (serialized.length < EFFECTIVE_LIMIT) {
              transaction.add(
                SystemProgram.transfer({
                  fromPubkey: publicKey,
                  toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                  lamports: totalFeeLamports,
                })
              );
            } else {
              console.warn(`Fee transfer won't fit in transaction, skipping fee transfer`);
            }
          }
        }

        // Final size check before sending - must be under the hard limit
        let finalSerialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
        if (finalSerialized.length > TRANSACTION_SIZE_LIMIT) {
          // If somehow we exceeded the limit, remove the last instruction(s) until we're under
          while (transaction.instructions.length > 0) {
            const testSize = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
            if (testSize <= TRANSACTION_SIZE_LIMIT) break;
            const removed = transaction.instructions.pop();
            if (!removed) break;
          }
          
          // Re-check size after trimming
          finalSerialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
          if (finalSerialized.length > TRANSACTION_SIZE_LIMIT) {
            throw new Error(`Transaction still too large after trimming: ${finalSerialized.length} bytes (limit: ${TRANSACTION_SIZE_LIMIT})`);
          }
        }

        // Sign and send this batch
        try {
          const signed = await signTransaction(transaction);
          const finalSize = signed.serialize().length;
          if (finalSize > TRANSACTION_SIZE_LIMIT) {
            throw new Error(`Signed transaction too large: ${finalSize} bytes (limit: ${TRANSACTION_SIZE_LIMIT}). This shouldn't happen if pre-checks passed.`);
          }
          
          const signature = await connection.sendRawTransaction(signed.serialize(), {
            skipPreflight: false,
            maxRetries: 3,
          });
              
              // Wait for confirmation before proceeding to next batch
              await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
              }, 'confirmed');
              
              totalClosed += batchCount;
            } catch (err) {
              if (isUserCancellation(err)) {
                setError('Transaction cancelled by user');
                setConverting(false);
                return;
              }
              throw err;
            }
            
            // Small delay between batches to avoid rate limiting
            if (instructionIndex < instructions.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
      
      if (totalClosed > 0) {
        const userAmount = totalRent * 0.9; // 90% to user
        setSuccess(`Successfully closed ${totalClosed} account(s)! Reclaimed ~${userAmount.toFixed(4)} SOL.`);
        // Refresh
        setTimeout(() => scanWallet(), 2000);
      }
    } catch (err) {
      console.error('Error closing accounts:', err);
      if (!isUserCancellation(err)) {
        setError(err instanceof Error ? err.message : 'Failed to close accounts');
      }
    } finally {
      setConverting(false);
    }
  }, [connected, publicKey, connection, emptyAccounts, scanWallet, signTransaction]);

  // Convert all to ORE: close empty accounts, then swap dust tokens, then swap reclaimed SOL to ORE
  // @ts-ignore - Unused function, kept for future use
  const convertAllToOre = useCallback(async () => {
    if (!connected || !publicKey || !connection) {
      setError('Please connect your wallet');
      return;
    }

    if (!signTransaction) {
      setError('Wallet not ready. Please connect your wallet.');
      return;
    }

    setConverting(true);
    setError(null);
    setInsufficientBalance(null);
    setSuccess(null);

    try {
      // Step 1: Close empty accounts to reclaim SOL (batched to avoid transaction size limit)
      if (emptyAccounts.length > 0) {
        try {
          // Prepare all close instructions first
          const instructions: Array<{ instruction: any; rent: number }> = [];

          for (const account of emptyAccounts) {
            try {
              const accountPubkey = new PublicKey(account.address);
              const accountInfo = await connection.getAccountInfo(accountPubkey);
              if (!accountInfo) continue;
              
              try {
                const closeInstruction = createCloseAccountInstruction(
                  accountPubkey,
                  publicKey,
                  publicKey,
                  []
                );
                instructions.push({
                  instruction: closeInstruction,
                  rent: account.rent,
                });
              } catch (err) {
                console.warn(`Skipping account ${account.address}:`, err);
              }
            } catch (err) {
              console.error(`Error creating close instruction for ${account.address}:`, err);
            }
          }

          // Calculate total rent that will be reclaimed
          const totalRentClosed = instructions.reduce((sum, inst) => sum + inst.rent, 0);
          const totalFee = totalRentClosed * 0.1; // 10% fee
          const totalFeeLamports = Math.floor(totalFee * LAMPORTS_PER_SOL);
          
          // Check if user has enough SOL balance for the fee + transaction costs
          // Plus we need to ensure they have enough after the fee transfer (minimum rent exemption for wallet is ~0.00089 SOL)
          const minBalanceAfterTransaction = 0.0009; // Slightly above rent exemption minimum
          const requiredBalance = totalFee + 0.0001 + minBalanceAfterTransaction;
          const currentBalance = await connection.getBalance(publicKey);
          const currentBalanceSOL = currentBalance / LAMPORTS_PER_SOL;
          
          // Calculate balance after rent is reclaimed
          const balanceAfterReclaim = currentBalanceSOL + totalRentClosed;
          const balanceAfterFee = balanceAfterReclaim - totalFee - 0.0001; // Account for transaction fees
          
          if (currentBalanceSOL < requiredBalance || balanceAfterFee < minBalanceAfterTransaction) {
            setInsufficientBalance({
              current: currentBalanceSOL,
              required: minBalanceAfterTransaction,
            });
            setConverting(false);
            return;
          }
          
          // Clear insufficient balance if we have enough
          setInsufficientBalance(null);

          // Batch instructions dynamically - add as many as possible up to transaction size limit (1232 bytes)
          const TRANSACTION_SIZE_LIMIT = 1232; // Solana transaction size limit in bytes
          const SAFETY_MARGIN = 20; // Safety margin to account for serialization differences
          const EFFECTIVE_LIMIT = TRANSACTION_SIZE_LIMIT - SAFETY_MARGIN; // 1212 bytes
          
          let instructionIndex = 0;
          while (instructionIndex < instructions.length) {
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
            
            // Get current balance (includes rent from previous batches if any)
            const balanceBeforeBatch = await connection.getBalance(publicKey);
            const balanceBeforeBatchSOL = balanceBeforeBatch / LAMPORTS_PER_SOL;
            
            const transaction = new Transaction();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = publicKey;
            
            let batchRent = 0;
            let batchCount = 0;

            // Add close account instructions until we reach the size limit
            while (instructionIndex < instructions.length) {
              const { instruction, rent } = instructions[instructionIndex];
              const testTransaction = transaction.instructions.length > 0 
                ? Transaction.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }))
                : new Transaction();
              testTransaction.recentBlockhash = blockhash;
              testTransaction.feePayer = publicKey;
              
              // Add all current instructions
              for (const inst of transaction.instructions) {
                testTransaction.add(inst);
              }
              
              // Add the new instruction
              testTransaction.add(instruction);
              
              // Check if adding fee transfer would fit (only on last batch)
              let wouldAddFee = false;
              if (instructionIndex + 1 >= instructions.length && totalFeeLamports > 0) {
                const balanceAfterBatchRent = balanceBeforeBatchSOL + batchRent + rent;
                const estimatedTxFee = 0.0001;
                const feeAmountSOL = totalFeeLamports / LAMPORTS_PER_SOL;
                const balanceAfterFeeAndCosts = balanceAfterBatchRent - feeAmountSOL - estimatedTxFee;
                
                if (balanceAfterFeeAndCosts >= minBalanceAfterTransaction) {
                  testTransaction.add(
                    SystemProgram.transfer({
                      fromPubkey: publicKey,
                      toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                      lamports: totalFeeLamports,
                    })
                  );
                  wouldAddFee = true;
                }
              }
              
              // Check transaction size with safety margin
              const serialized = testTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
              if (serialized.length >= EFFECTIVE_LIMIT) {
                // This instruction won't fit, break and send current batch
                break;
              }
              
              // It fits, add it to the transaction
              transaction.add(instruction);
              batchRent += rent;
              batchCount++;
              instructionIndex++;
              
              // If we're adding the fee, this is the last instruction in the batch
              if (wouldAddFee) {
                transaction.add(
                  SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                    lamports: totalFeeLamports,
                  })
                );
                break;
              }
            }
            
            // If this is the last batch and we haven't added the fee yet, try to add it
            if (instructionIndex >= instructions.length && totalFeeLamports > 0 && !transaction.instructions.some(inst => inst.programId.equals(SystemProgram.programId) && inst.keys.some(key => key.pubkey.equals(RENT_RECLAIM_FEE_ADDRESS)))) {
              const balanceAfterBatchRent = balanceBeforeBatchSOL + batchRent;
              const estimatedTxFee = 0.0001;
              const feeAmountSOL = totalFeeLamports / LAMPORTS_PER_SOL;
              const balanceAfterFeeAndCosts = balanceAfterBatchRent - feeAmountSOL - estimatedTxFee;
              
              if (balanceAfterFeeAndCosts >= minBalanceAfterTransaction) {
                const testTransaction = Transaction.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }));
                testTransaction.add(
                  SystemProgram.transfer({
                    fromPubkey: publicKey,
                    toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                    lamports: totalFeeLamports,
                  })
                );
                
                const serialized = testTransaction.serialize({ requireAllSignatures: false, verifySignatures: false });
                if (serialized.length < EFFECTIVE_LIMIT) {
                  transaction.add(
                    SystemProgram.transfer({
                      fromPubkey: publicKey,
                      toPubkey: RENT_RECLAIM_FEE_ADDRESS,
                      lamports: totalFeeLamports,
                    })
                  );
                } else {
                  console.warn(`Fee transfer won't fit in transaction, skipping fee transfer`);
                }
              }
            }

            // Final size check before sending - must be under the hard limit
            let finalSerialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
            if (finalSerialized.length > TRANSACTION_SIZE_LIMIT) {
              // If somehow we exceeded the limit, remove the last instruction(s) until we're under
              while (transaction.instructions.length > 0) {
                const testSize = transaction.serialize({ requireAllSignatures: false, verifySignatures: false }).length;
                if (testSize <= TRANSACTION_SIZE_LIMIT) break;
                const removed = transaction.instructions.pop();
                if (!removed) break;
              }
              
              // Re-check size after trimming
              finalSerialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
              if (finalSerialized.length > TRANSACTION_SIZE_LIMIT) {
                throw new Error(`Transaction still too large after trimming: ${finalSerialized.length} bytes (limit: ${TRANSACTION_SIZE_LIMIT})`);
              }
            }

            // Sign and send this batch
            try {
              const signed = await signTransaction(transaction);
              const finalSize = signed.serialize().length;
              if (finalSize > TRANSACTION_SIZE_LIMIT) {
                throw new Error(`Signed transaction too large: ${finalSize} bytes (limit: ${TRANSACTION_SIZE_LIMIT}). This shouldn't happen if pre-checks passed.`);
              }
              
              const signature = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: false,
                maxRetries: 3,
              });
              
              // Wait for confirmation before proceeding to next batch
              await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight,
              }, 'confirmed');
            } catch (err) {
              if (isUserCancellation(err)) {
                setError('Transaction cancelled by user');
                setConverting(false);
                return;
              }
              throw err;
            }
            
            // Small delay between batches
            if (instructionIndex < instructions.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // Wait a bit for the SOL to be available
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err) {
          if (isUserCancellation(err)) {
            setError('Transaction cancelled by user');
            setConverting(false);
            return;
          }
          console.warn('Error closing accounts:', err);
          // Continue even if closing accounts fails (unless user cancelled)
        }
      }

      // Step 2: Convert dust tokens to ORE
      const worthConvertingTokens = dustTokens.filter(t => t.worthConverting);
      let cancelled = false;
      if (worthConvertingTokens.length > 0) {
        let successCount = 0;
        
        for (const token of worthConvertingTokens) {
          if (cancelled) break;
          
          try {
            const quoteUrl = `${JUPITER_API_BASE}/quote?inputMint=${token.mint}&outputMint=${ORE_MINT.toBase58()}&amount=${token.balance}&slippageBps=100`;
            const quoteResponse = await fetch(quoteUrl);
            
            if (!quoteResponse.ok) continue;

            const quote = await quoteResponse.json();
            
            const swapResponse = await fetch(`${JUPITER_API_BASE}/swap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                quoteResponse: quote,
                userPublicKey: publicKey.toBase58(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 'auto',
              }),
            });

            if (!swapResponse.ok) continue;

            const { swapTransaction } = await swapResponse.json();
            const transactionBuf = Buffer.from(swapTransaction, 'base64');
            const transaction = Transaction.from(transactionBuf);
            
            try {
              const signed = await signTransaction(transaction);
              const signature = await connection.sendRawTransaction(signed.serialize(), {
                skipPreflight: false,
                maxRetries: 3,
              });
              
              await connection.confirmTransaction(signature, 'confirmed');
              successCount++;
            } catch (err) {
              if (isUserCancellation(err)) {
                cancelled = true;
                setError('Transaction cancelled by user');
                setConverting(false);
                return;
              }
              throw err;
            }
            
            // Small delay between swaps
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (err) {
            if (isUserCancellation(err)) {
              cancelled = true;
              setError('Transaction cancelled by user');
              setConverting(false);
              return;
            }
            console.error(`Error swapping token ${token.mint}:`, err);
          }
        }
        
        if (cancelled) return;
      }

      // Step 3: Swap reclaimed SOL to ORE (if we closed any accounts)
      if (emptyAccounts.length > 0 && totalRentReclaimable > 0.001) {
        try {
          // Wait for accounts to be closed and rent to be reclaimed
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Get updated balance after closing accounts
          const updatedBalance = await connection.getBalance(publicKey);
          const solBalance = updatedBalance / LAMPORTS_PER_SOL;
          
          // Use the amount we expected to reclaim (minus some for fees)
          // Don't use full balance in case user has other SOL
          const solToSwap = Math.min(solBalance * 0.9, totalRentReclaimable * 0.95);
          
          if (solToSwap > 0.001) {
            const solAmountLamports = Math.floor(solToSwap * LAMPORTS_PER_SOL);
            
            const quoteUrl = `${JUPITER_API_BASE}/quote?inputMint=${SOL_MINT.toBase58()}&outputMint=${ORE_MINT.toBase58()}&amount=${solAmountLamports}&slippageBps=100`;
            const quoteResponse = await fetch(quoteUrl);
            
            if (quoteResponse.ok) {
              const quote = await quoteResponse.json();
              
              if (quote.outAmount) {
                const swapResponse = await fetch(`${JUPITER_API_BASE}/swap`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    quoteResponse: quote,
                    userPublicKey: publicKey.toBase58(),
                    wrapAndUnwrapSol: true,
                    dynamicComputeUnitLimit: true,
                    prioritizationFeeLamports: 'auto',
                  }),
                });

                if (swapResponse.ok) {
                  const { swapTransaction } = await swapResponse.json();
                  const transactionBuf = Buffer.from(swapTransaction, 'base64');
                  const transaction = Transaction.from(transactionBuf);
                  
                  const signed = await signTransaction(transaction);
                  const signature = await connection.sendRawTransaction(signed.serialize(), {
                    skipPreflight: false,
                    maxRetries: 3,
                  });
                  
                  await connection.confirmTransaction(signature, 'confirmed');
                }
              }
            }
          }
        } catch (err) {
          if (isUserCancellation(err)) {
            cancelled = true;
            setError('Transaction cancelled by user');
            setConverting(false);
            return;
          }
          console.warn('Error swapping reclaimed SOL to ORE:', err);
          // Don't fail the whole operation if SOL swap fails
        }
      }

      // Only show success if we didn't cancel
      if (!cancelled) {
        setSuccess('Successfully converted all dust and reclaimed SOL to ORE!');
        // Refresh
        setTimeout(() => scanWallet(), 2000);
      }
    } catch (err) {
      console.error('Error converting all to ORE:', err);
      if (!isUserCancellation(err)) {
        setError(err instanceof Error ? err.message : 'Failed to convert all to ORE');
      }
    } finally {
      setConverting(false);
    }
  }, [connected, publicKey, connection, emptyAccounts, dustTokens, scanWallet, signTransaction, isUserCancellation]);

  // Format ORE value with appropriate precision for small decimals
  const formatOreValue = (value: number): string => {
    if (value === 0) return '0';
    if (value < 0.01) {
      return value.toFixed(8);
    } else if (value < 1) {
      return value.toFixed(6);
    } else if (value < 10) {
      return value.toFixed(4);
    } else if (value < 100) {
      return value.toFixed(2);
    } else {
      return value.toFixed(2);
    }
  };

  const totalRentReclaimable = emptyAccounts.reduce((sum, a) => sum + a.rent, 0);
  // Display value: full rent amount (before fee)
  const totalRentReclaimableDisplay = totalRentReclaimable;
  // Net amount user receives after 10% fee (for ORE estimate calculations)
  const totalRentReclaimableNet = totalRentReclaimable * 0.9;
  const worthConvertingTokens = dustTokens.filter(t => t.worthConverting);
  
  const totalEstimatedORE = dustTokens
    .filter(t => t.worthConverting)
    .reduce((sum, t) => sum + t.estimatedORE, 0);
  
  // Estimate ORE from reclaimed SOL using Jupiter quote (based on what user receives)
  const [estimatedOreFromReclaimedSol, setEstimatedOreFromReclaimedSol] = useState<number>(0);
  const [oreEstimateLoading, setOreEstimateLoading] = useState(false);
  
  useEffect(() => {
    const fetchOreEstimate = async () => {
      if (totalRentReclaimableNet > 0) {
        setOreEstimateLoading(true);
        try {
          // Use the amount user will receive (90% of total after fee)
          const solAmountLamports = Math.floor(totalRentReclaimableNet * LAMPORTS_PER_SOL);
          
          // Try Jupiter quote for any amount > 0.00001 SOL
          if (solAmountLamports > 10000) { // 0.00001 SOL in lamports
            try {
              const quoteUrl = `${JUPITER_API_BASE}/quote?inputMint=${SOL_MINT.toBase58()}&outputMint=${ORE_MINT.toBase58()}&amount=${solAmountLamports}&slippageBps=50`;
              const quoteResponse = await fetch(quoteUrl);
              
              if (quoteResponse.ok) {
                const quote = await quoteResponse.json();
                if (quote.outAmount) {
                  // ORE has 9 decimals, so divide by 1e9
                  // But check if outAmount might already be in a different format
                  const outAmountStr = quote.outAmount.toString();
                  const outAmountNum = parseInt(outAmountStr);
                  
                  // Convert to ORE (ORE has 9 decimals)
                  const estimatedORE = outAmountNum / 1e9;
                  
                  // Debug: log to verify conversion
                  console.log('Jupiter quote:', {
                    solAmount: totalRentReclaimableNet,
                    solLamports: solAmountLamports,
                    outAmount: outAmountStr,
                    estimatedORE: estimatedORE,
                  });
                  
                  if (estimatedORE > 0) {
                    setEstimatedOreFromReclaimedSol(estimatedORE);
                    setOreEstimateLoading(false);
                    return;
                  }
                }
              }
            } catch (quoteErr) {
              console.warn('Jupiter quote failed, using fallback:', quoteErr);
            }
          }
          
          // Fallback: Get ORE price from state API and calculate
          // Based on real swap: 0.058 SOL ≈ 0.0333 ORE, so ~0.574 ORE per SOL
          let estimate = 0;
          try {
            const stateResponse = await fetch('https://ore-api.gmore.fun/v2/state');
            const stateData = await stateResponse.json();
            
            // New v2 API format: globals.orePrice.priceUsdRaw
            const orePriceRaw = stateData.globals?.orePrice?.priceUsdRaw;
            const orePriceUsd = orePriceRaw ? parseFloat(orePriceRaw) : null;
            
            if (orePriceUsd && solPrice) {
              // Use USD prices: (SOL amount * SOL price) / ORE price
              estimate = (totalRentReclaimableNet * solPrice) / orePriceUsd;
            } else if (solPrice) {
              // If no ORE price, use observed rate: ~0.574 ORE per SOL
              // This is based on real swaps showing 0.058 SOL → 0.0333 ORE
              const orePerSol = 0.574; // Actual observed rate
              estimate = totalRentReclaimableNet * orePerSol;
            }
          } catch (err) {
            // Final fallback: use observed ORE per SOL rate from real swaps
            const orePerSol = 0.574; // 0.0333 / 0.058 ≈ 0.574
            estimate = totalRentReclaimableNet * orePerSol;
          }
          
          if (estimate > 0) {
            setEstimatedOreFromReclaimedSol(estimate);
          }
        } catch (err) {
          console.warn('Error fetching ORE estimate:', err);
        } finally {
          setOreEstimateLoading(false);
        }
      } else {
        setEstimatedOreFromReclaimedSol(0);
        setOreEstimateLoading(false);
      }
    };
    
    fetchOreEstimate();
  }, [totalRentReclaimableNet, solPrice, orePrice]);
  
  const totalEstimatedOREFull = totalEstimatedORE + estimatedOreFromReclaimedSol;

  if (!connected) {
    return (
      <div className="min-h-screen bg-black text-white py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Dust to ORE Converter</h1>
            <p className="text-slate-400 mb-6">
              Connect your wallet to automatically convert leftover memecoin dust into $ORE
            </p>
            <button
              onClick={() => setVisible(true)}
              disabled={connecting}
              className="bg-white text-black hover:bg-gray-100 rounded-full px-6 py-3 text-base font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">Dust to ORE Converter</h1>
          <p className="text-slate-400">
            Convert leftover memecoin dust and reclaim SOL from empty accounts
          </p>
        </div>

        {/* Status Messages */}
        {insufficientBalance && (
          <div className="mb-4 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <SolanaLogo width={20} height={20} />
              </div>
              <div className="flex-1">
                <p className="text-amber-300 font-medium mb-2">Insufficient SOL Balance</p>
                <p className="text-xs text-slate-400 mb-3">
                  A minimum SOL balance is required to execute the transaction that closes empty accounts and reclaims the locked rent.
                </p>
                <div className="space-y-1 text-sm text-amber-200/90">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Current balance:</span>
                    <div className="flex items-center gap-1">
                      <SolanaLogo width={14} height={14} />
                      <span className="font-medium">{insufficientBalance.current.toFixed(4)} SOL</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Required:</span>
                    <div className="flex items-center gap-1">
                      <SolanaLogo width={14} height={14} />
                      <span className="font-medium">{insufficientBalance.required.toFixed(4)} SOL</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-300">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-amber-500/20 border border-amber-500/50 rounded-lg">
            <p className="text-amber-300">{success}</p>
          </div>
        )}
        
        {/* Loading Status */}
        {loading && (
          <div className="mb-4 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
              <p className="text-blue-300">
                {loadingStatus || 'Scanning wallet...'}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons - Primary CTA at Top */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <button
            onClick={scanWallet}
            disabled={loading}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Scanning...</span>
              </>
            ) : (
              'Refresh Scan'
            )}
          </button>
          {emptyAccounts.length > 0 && (
            <button
              onClick={closeEmptyAccounts}
              disabled={converting}
              className="px-6 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {converting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Reclaiming...</span>
                </>
              ) : (
                <>
                  <SolanaLogo width={16} height={16} />
                  <span>Reclaim ~{totalRentReclaimableDisplay.toFixed(4)} SOL from {emptyAccounts.length} account{emptyAccounts.length > 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          )}
          {worthConvertingTokens.length > 0 && (
            <button
              onClick={() => convertDustToOre(worthConvertingTokens)}
              disabled={converting}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {converting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Swapping...</span>
                </>
              ) : (
                <>
                  <img src="/orelogo.jpg" alt="ORE" className="w-5 h-5 object-contain rounded" />
                  <span>Swap {worthConvertingTokens.length} Token{worthConvertingTokens.length > 1 ? 's' : ''} to ORE</span>
                </>
              )}
            </button>
          )}
          
          {/* How It Works - Helper Tooltip */}
          <div className="relative group ml-auto">
            <button
              type="button"
              className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-slate-300 transition-colors cursor-help"
              aria-label="How it works"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold">How it works?</span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg p-4 shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
              <h3 className="text-sm font-semibold text-white mb-3">How it works?</h3>
              <div className="space-y-3 text-xs text-slate-300">
                <div>
                  <strong className="text-white block mb-1">1. Reclaim Rent from Empty Accounts</strong>
                  <p className="text-slate-400 leading-relaxed">
                    On Solana, every token account requires SOL to "rent" its on-chain storage space (~0.0018 SOL per account). When a token account has zero balance, this rent SOL is locked but can be reclaimed by closing the account. We scan for empty accounts and close them to recover this SOL back to your wallet.
                  </p>
                </div>
                <div>
                  <strong className="text-white block mb-1">2. Convert Dust Tokens to ORE</strong>
                  <p className="text-slate-400 leading-relaxed">
                    Small token balances worth less than $10 USD are considered "dust" - often too small to be worth individual swaps. We identify these tokens and swap them all to ORE using Jupiter aggregator.
                  </p>
                </div>
                <p className="mt-3 pt-2 border-t border-slate-700 text-[10px] text-slate-400">
                  All transactions execute sequentially for security and reliability.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Summary Cards */}
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <div className="text-xs text-slate-400 mb-1">Dust Tokens Found</div>
            <div className="text-xs text-slate-500 mb-1">(Tokens available to convert)</div>
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400"></div>
                <span className="text-sm text-slate-400">Scanning...</span>
              </div>
            ) : (
              <div className="text-2xl font-bold text-white">{dustTokens.length}</div>
            )}
          </div>
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <div className="text-xs text-slate-400 mb-1">Empty Accounts Ready</div>
            <div className="text-xs text-slate-500 mb-1">(Accounts that can be closed to reclaim rent)</div>
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400"></div>
                <span className="text-sm text-slate-400">Scanning...</span>
              </div>
            ) : (
              <div className="text-2xl font-bold text-white">{emptyAccounts.length}</div>
            )}
          </div>
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <div className="text-xs text-slate-400 mb-1">Estimated ORE</div>
            <div className="text-xs text-slate-500 mb-1">(Amount you can claim by swapping this SOL)</div>
            <div className="text-2xl font-bold text-white flex items-center gap-2">
              <img src="/orelogo.jpg" alt="ORE" className="w-6 h-6 object-contain rounded" />
              <span>
                {loading || oreEstimateLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
                    <span className="text-sm text-slate-400">Loading...</span>
                  </div>
                ) : totalEstimatedOREFull > 0 ? (
                  formatOreValue(totalEstimatedOREFull)
                ) : (
                  '0'
                )}
              </span>
            </div>
          </div>
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6">
            <div className="text-xs text-slate-400 mb-1">Rent Reclaimable</div>
            <div className="text-xs text-slate-500 mb-1">(SOL you can reclaim from empty accounts)</div>
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400"></div>
                <span className="text-sm text-slate-400">Scanning...</span>
              </div>
            ) : (
              <div className="text-2xl font-bold text-white flex items-center gap-2">
                <SolanaLogo width={24} height={24} />
                <span>{totalRentReclaimableDisplay > 0 ? `~${totalRentReclaimableDisplay.toFixed(4)}` : '0'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Empty Accounts List - First */}
        {emptyAccounts.length > 0 && (
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Empty Accounts</h2>
            <p className="text-sm text-slate-400 mb-4">
              These accounts have no tokens and can be closed to reclaim rent (~0.0018 SOL each)
            </p>
            <div className="space-y-2">
              {emptyAccounts.map((account) => (
                <div
                  key={account.address}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="font-mono text-sm text-slate-300">
                    {account.address.slice(0, 8)}...{account.address.slice(-8)}
                  </div>
                  <div className="text-sm text-white flex items-center gap-1">
                    <SolanaLogo width={12} height={12} />
                    <span>~{account.rent.toFixed(4)} rent</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dust Tokens List - Second */}
        {dustTokens.length > 0 && (
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Dust Tokens</h2>
            <div className="space-y-2">
              {dustTokens.map((token) => (
                <div
                  key={token.address}
                  className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700"
                >
                  <div className="flex items-center gap-3">
                    {token.logoURI ? (
                      <img 
                        src={token.logoURI} 
                        alt={token.symbol || token.name || 'Token'} 
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          // Fallback to initial if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className={`w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center ${token.logoURI ? 'hidden' : ''}`}
                    >
                      <span className="text-xs text-slate-300">
                        {token.symbol?.charAt(0) || token.mint.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {token.name || token.symbol || token.mint.slice(0, 4).toUpperCase()}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {token.mint.slice(0, 8)}...{token.mint.slice(-6)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-medium text-white">
                        {token.uiAmount.toFixed(6)} {token.symbol || token.mint.slice(0, 4).toUpperCase()}
                      </div>
                      {loadingQuotes.has(token.address) ? (
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          <div className="animate-spin rounded-full h-3 w-3 border-b border-slate-400"></div>
                          <span>Loading quote...</span>
                        </div>
                      ) : token.estimatedORE > 0 ? (
                        <div className="text-xs text-slate-400 flex items-center gap-1">
                          ≈ {formatOreValue(token.estimatedORE)}{' '}
                          <img src="/orelogo.jpg" alt="ORE" className="w-3 h-3 object-contain rounded" />
                        </div>
                      ) : null}
                    </div>
                    {loadingQuotes.has(token.address) ? (
                      <span className="px-2 py-1 bg-slate-700 text-slate-400 text-xs rounded flex items-center gap-1">
                        <div className="animate-spin rounded-full h-2 w-2 border-b border-slate-400"></div>
                        <span>Loading...</span>
                      </span>
                    ) : token.worthConverting ? (
                      <span className="px-2 py-1 bg-amber-900/30 text-amber-400 text-xs rounded">
                        Convertible
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-700 text-slate-400 text-xs rounded">
                        Too Small
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && dustTokens.length === 0 && emptyAccounts.length === 0 && connected && (
          <div className="bg-[#21252C] border border-slate-700 rounded-lg p-8 text-center">
            <p className="text-slate-400">No dust tokens or empty accounts found. Your wallet is clean! 🎉</p>
          </div>
        )}
      </div>
    </div>
  );
}

