import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for Buffer and other Node.js globals
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  server: {
    proxy: {
      '/api/inflation': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // Proxy specific token routes individually, excluding top-holders
      '/api/token/current': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api/token/history': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api/token/distribution': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      // top-holders is handled by Vercel serverless function - don't proxy it
      '/api/buyback-wallet': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api/revenue': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api/staking': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
          '/api/liquidity': {
            target: 'https://refinorev2-production.up.railway.app',
            changeOrigin: true,
            rewrite: (path) => path,
          },
          '/api/metrics': {
            target: 'https://refinorev2-production.up.railway.app',
            changeOrigin: true,
            rewrite: (path) => path,
          },
          '/api/profile': {
            target: 'https://refinorev2-production.up.railway.app',
            changeOrigin: true,
            rewrite: (path) => path,
          },
          '/api/miners': {
            target: 'https://refinorev2-production.up.railway.app',
            changeOrigin: true,
            rewrite: (path) => path,
          },
          // Proxy for ore-api.gmore.fun v2 endpoints to avoid CORS (development only)
          // Use a different path to avoid conflicts with serverless functions
          '/api/ore-v2/state': {
            target: 'https://ore-api.gmore.fun',
            changeOrigin: true,
            rewrite: () => '/v2/state',
          },
          '/api/ore-v2/bids': {
            target: 'https://ore-api.gmore.fun',
            changeOrigin: true,
            rewrite: () => '/v2/bids',
          },
        },
      },
    })
