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
