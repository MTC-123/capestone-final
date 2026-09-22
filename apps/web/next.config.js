/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  compress: true,
  swcMinify: true,
  productionBrowserSourceMaps: false,
  experimental: {
    webpackMemoryOptimizations: true,
    serverActions: {
      allowedOrigins: ['*'],
      bodySizeLimit: '10mb',
    },
    optimizePackageImports: ['lucide-react', 'recharts', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/mapbox', 'date-fns', 'lodash-es'],
    serverComponentsExternalPackages: [
      'bcrypt',
      '@sentry/nextjs',
      '@sentry/opentelemetry',
      '@opentelemetry/instrumentation',
      'require-in-the-middle',
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
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
