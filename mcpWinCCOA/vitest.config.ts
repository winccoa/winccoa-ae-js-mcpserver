import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/types/**'],
      reporter: ['text', 'lcov']
    }
  },
  resolve: {
    alias: {
      // Redirect winccoa-manager imports to our mock fixture so tests can run
      // in CI without WinCC OA installed. On developer machines with WinCC OA,
      // the real package is available as a peerDependency.
      'winccoa-manager': resolve(__dirname, 'tests/fixtures/mock-winccoa-manager.ts')
    }
  }
});
