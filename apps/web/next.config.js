/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Lets a production build run alongside `next dev` (e.g. NEXT_DIST_DIR=.next-prod).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  compress: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  reactStrictMode: true,

  turbopack: {
    resolveAlias: {
      // react-map-gl resolves `mapbox-gl`; the app renders with MapLibre.
      'mapbox-gl': 'maplibre-gl',
    },
  },

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
    optimizePackageImports: ['lucide-react', 'recharts', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/mapbox'],
  },

  serverExternalPackages: ['@sentry/nextjs', '@sentry/opentelemetry', '@opentelemetry/instrumentation', 'require-in-the-middle'],

  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    // WebP only: AVIF decoding in the image optimizer has had critical advisories.
    formats: ['image/webp'],
    minimumCacheTTL: 2592000, // 30 days
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536],
    imageSizes: [32, 48, 64, 96, 128, 256],
  },

  async headers() {
    // Page responses get a nonce-based CSP from the proxy; these apply to
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
};

module.exports = nextConfig;
