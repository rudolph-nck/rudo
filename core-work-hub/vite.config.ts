import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// One self-contained index.html: JS, CSS and the Plus Jakarta Sans font files are all inlined,
// so the page opens straight from the shared folder with no network and nothing to host.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
