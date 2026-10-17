import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// Content Security Policy for the production build. GitHub Pages cannot send headers, so it is a meta
// tag (frame-ancestors is not supported in meta and is therefore absent). Injected at build time only,
// so the dev server keeps its inline HMR client working.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'catalog-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

export default defineConfig({
  base: '/home-ai-marketplace-learning/',
  plugins: [react(), cspMeta()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    modulePreload: { polyfill: false },
    // Never inline assets as data URLs.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    exclude: ['node_modules', 'dist', 'src/dist-checks/**'],
    restoreMocks: true,
  },
});
