import { defineConfig } from 'vitest/config';

// Checks of the production build output; run after `npm run build`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/dist-checks/**/*.spec.ts'],
  },
});
