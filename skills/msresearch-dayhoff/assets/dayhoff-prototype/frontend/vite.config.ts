/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// BASE_URL is baked at build time. Default '/' for local dev / root-path
// deployment; the build pipeline passes the desired sub-path via the env
// var so static asset URLs are prefixed correctly inside the Vite build
// output.
export default defineConfig({
  base: process.env.BASE_URL || '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
  server: {
    host: '0.0.0.0',  // Bind to all interfaces for dev container access
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
