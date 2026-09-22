import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['./tests/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['./tests/e2e/**', './tests/performance/**', './node_modules/**'],
    coverage: {
      provider: 'v8',
      include: [
        'src/lib/errors/**',
        'src/lib/observability/**',
        'src/lib/dispatch/**',
        'src/lib/routing/**',
        'src/lib/firms/**',
        'src/lib/effis/**',
        'src/lib/detections/**',
        'src/lib/risk/**',
        'src/lib/map/**',
        'src/lib/gpu/**',
        'src/lib/ratelimit/**',
        'src/lib/cache/**',
        'src/lib/database/**',
        'src/lib/notifications/**',
        'src/lib/fire-records/**',
        'src/store/**',
        'src/components/ui/Logo.tsx',
        'src/components/layout/ThemeToggle.tsx',
        'src/components/layout/Footer.tsx',
        'src/components/map/RicerMap.tsx',
      ],
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
