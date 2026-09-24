import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import jsxA11y from 'eslint-plugin-jsx-a11y';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // eslint-config-next already registers the jsx-a11y plugin; enable its full recommended set.
    rules: {
      ...jsxA11y.flatConfigs.recommended.rules,
      'jsx-a11y/anchor-is-valid': 'off',
      // React Compiler guidance (eslint-plugin-react-hooks v7). New code
      // follows it; older modules are being migrated, so these warn for now.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/static-components': 'warn',
    },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
  },
  {
    // Test doubles legitimately use loose types and CommonJS requires.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@next/next/no-img-element': 'off',
      // Mocked third-party components only mirror props for assertions.
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
    },
  },
  globalIgnores(['.next/**', '.next-prod/**', 'out/**', 'build/**', 'next-env.d.ts', 'coverage/**', 'playwright-report/**', 'test-results/**', 'public/sw.js']),
]);
