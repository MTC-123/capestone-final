FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
COPY apps/web/prisma ./prisma
RUN npm install --omit=dev

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./
COPY apps/web/prisma ./prisma
RUN npm install
COPY apps/web/. .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Placeholder build-time env vars so Next.js can evaluate route modules.
# Railway overrides these with real values at runtime.
ENV DATABASE_URL="mongodb://build-placeholder:27017/placeholder"
ENV JWT_SECRET="build-time-placeholder-not-used-at-runtime"
ENV FIRMS_MAP_KEY="build-placeholder"
ENV NEXT_PUBLIC_OWM_API_KEY="build-placeholder"
RUN npm run build

FROM node:20-alpine AS runtime
RUN apk add --no-cache dumb-init openssl
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV NODE_OPTIONS="--max-old-space-size=2048"
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health',(r)=>{process.exit(r.statusCode===200?0:1)})"
ENTRYPOINT ["/usr/bin/dumb-init","--"]
CMD ["node","server.js"]
