// Configure the Svelte/Tailwind build, SQLite worker assets, and preview origins.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  // The SQLite module instantiates its own worker and loads wasm at runtime.
  optimizeDeps: { exclude: ['@sqlite.org/sqlite-wasm'] },
  worker: { format: 'es' },
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.e2b.app', '.localhost'],
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        realpathSync(resolve('node_modules')),
      ],
    },
  },
  preview: { host: '0.0.0.0', allowedHosts: ['.e2b.app', '.localhost'] },
  build: { target: 'es2023', sourcemap: true },
});
