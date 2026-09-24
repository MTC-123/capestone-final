/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Lets a production build run alongside `next dev` (e.g. NEXT_DIST_DIR=.next-prod).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Server actions only accept same-origin requests plus explicitly
      // listed hosts (comma-separated in SERVER_ACTIONS_ALLOWED_ORIGINS).
      allowedOrigins: (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
      bodySizeLimit: '2mb',
    },
    optimizePackageImports: ['lucide-react', 'recharts', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/mapbox', 'date-fns', 'lodash-es'],
    serverComponentsExternalPackages: [
      '@sentry/nextjs',
      '@sentry/opentelemetry',
      '@opentelemetry/instrumentation',
      'require-in-the-middle',
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    // Page responses get a nonce-based CSP from middleware; these apply to
    // every response, including API routes and static assets.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000, // 30 days
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  webpack: (config, { isServer }) => {
    // MapLibre GL configuration - disable Node.js modules in client bundle
    if (!isServer) {
      // Alias mapbox-gl to maplibre-gl (react-map-gl compatibility)
      config.resolve.alias = {
        ...config.resolve.alias,
        'mapbox-gl': 'maplibre-gl',
      };

      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };

      // Code splitting optimization
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // MapLibre GL - separate chunk (large library)
            maplibre: {
              test: /[\\/]node_modules[\\/](maplibre-gl)[\\/]/,
              name: 'maplibre',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Recharts - separate chunk (analytics charts)
            recharts: {
              test: /[\\/]node_modules[\\/](recharts)[\\/]/,
              name: 'recharts',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Deck.gl - separate chunk (map overlays)
            deckgl: {
              test: /[\\/]node_modules[\\/](@deck\.gl)[\\/]/,
              name: 'deckgl',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Common libraries used across pages
            commons: {
              test: /[\\/]node_modules[\\/]/,
              name: 'commons',
              priority: 5,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    return config;
  },
};

module.exports = nextConfig;
