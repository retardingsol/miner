import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/inflation': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
      '/api/token': {
        target: 'https://refinorev2-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path,
      },
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
    },
  },
})
