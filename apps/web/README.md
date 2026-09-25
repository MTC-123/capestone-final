# RICER web app

The Next.js 16 application. The project overview, features and test matrix are in the [root README](../../README.md); free-tier deployment is in [docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

## Develop

```bash
cp .env.example .env.local   # DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_PEPPER
npm ci                       # also copies MapLibre's worker into public/maplibre
npx prisma db push
npm run prisma:seed          # demo data: CD789012 (official) / AB123456 (resident), password123
npm run dev
```

## Layout

| Path | Contents |
|---|---|
| `src/app` | Routes: `(protected)` pages, `api/*` route handlers, public auth and landing pages |
| `src/proxy.ts` | Request proxy: page-level RBAC, nonce CSP, security headers |
| `src/components/shell` | App frame: ops rail, civic header, mobile tab bar, command palette |
| `src/lib/security` | Role guards and rate limits (Upstash, or in-memory fallback) |
| `src/lib/offline` | IndexedDB queue, sync engine and service-worker registration |
| `src/lib/risk` | XGBoost evaluator, feature builder, model card |
| `src/lib/notifications` | Event fan-out to in-app, email and WhatsApp adapters (QStash delivery) |
| `src/lib/dispatch` | Routing, atomic claims, assignment |
| `prisma/` | Schema, seed (`seed.ts`, `seed-data/`) and load seed (`seed-load.ts`) |
| `tests/` | `unit`, `integration` (mocked Prisma), `db` (real MongoDB), `e2e` (Playwright; `e2e/live` runs without mocks) |
| `perf/` | k6 workload for 10/25/50 concurrent users |

## Scripts

| Script | Purpose |
|---|---|
| `dev` · `build` · `start` | Next.js (Turbopack) |
| `lint` · `typecheck` | ESLint 9 flat config · `tsc --noEmit` |
| `test:unit` · `test:db` · `test:e2e` | Vitest · real-MongoDB integration · Playwright |
| `perf:k6` | Load test (against a production build) |
| `prisma:seed` · `prisma:seed:load` | Demo data · 1,000 synthetic incidents for load tests |
| `db:backup` · `db:restore` | mongodump / mongorestore helpers ([runbook](../../docs/runbooks/backup-restore.md)) |
| `ml:export` | Re-export the partner model to `src/lib/risk/model/model.json` |
