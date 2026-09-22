const { chromium } = require('playwright');

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run start -- -p 3000',
      startServerReadyPattern: 'Ready',
      url: ['http://localhost:3000/signin', 'http://localhost:3000/signup', 'http://localhost:3000/styleguide'],
      numberOfRuns: 1,
      chromePath: chromium.executablePath(),
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
