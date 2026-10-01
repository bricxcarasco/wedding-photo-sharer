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
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
