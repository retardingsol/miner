// IMPORTANT: Buffer must be imported and set up BEFORE any Solana imports
import { Buffer } from 'buffer';

// Make Buffer available globally BEFORE any other imports
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}
// Also make it available globally for modules that use it
(globalThis as any).Buffer = Buffer;

// Now import everything else
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { SolanaWalletProvider } from './solana/WalletProvider.tsx';
import { Analytics } from '@vercel/analytics/react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolanaWalletProvider>
      <App />
      <Analytics />
    </SolanaWalletProvider>
  </StrictMode>,
);
