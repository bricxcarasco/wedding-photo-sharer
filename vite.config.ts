/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Mobile-first wedding PWA. The service worker (public/sw.js) and manifest
// (public/manifest.webmanifest) are plain static files registered at runtime,
// so we keep the Vite config minimal and Vercel-friendly.
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the stable framework runtime into its own chunk so it stays
        // cached across app deploys (app code changes far more often than
        // React/router). Purely a caching/splitting optimization — no behavior
        // change. Route-level code-splitting (React.lazy in App.tsx) is unaffected.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
