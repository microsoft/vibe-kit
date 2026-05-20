import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev server for the MatterGen prototype frontend.
// Proxies API calls to the prototype FastAPI backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3010,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8010',
        changeOrigin: true,
      },
    },
  },
})
