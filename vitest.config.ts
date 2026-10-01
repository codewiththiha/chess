// Keep fast domain and persistence tests separate from real-browser tests.
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: { include: ['src/lib/domain/**', 'src/lib/data/**'] },
  },
});
