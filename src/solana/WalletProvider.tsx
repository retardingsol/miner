import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { clusterApiUrl } from '@solana/web3.js';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Default styles for wallet-adapter modal
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export function SolanaWalletProvider({ children }: SolanaWalletProviderProps) {
  // Use custom RPC endpoint if provided via environment variable, otherwise use public endpoint
  // For production, set VITE_SOLANA_RPC_URL to your RPC provider (Helius, QuickNode, Alchemy, etc.)
  const endpoint = useMemo(() => {
    const customEndpoint = import.meta.env.VITE_SOLANA_RPC_URL;
    if (customEndpoint) {
      return customEndpoint;
    }
    // Fallback to public RPC endpoint (may have rate limits)
    return clusterApiUrl('mainnet-beta');
  }, []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}


