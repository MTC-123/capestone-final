<p align="center">
  <img src="docs/assets/brand/banner.svg" alt="RICER Ifrane: fire reporting, dispatch and multi-agency coordination for Ifrane Province, Morocco" width="100%">
</p>

<p align="center">
  <a href="https://github.com/MTC-123/capestone-final/actions/workflows/ci.yml"><img src="https://github.com/MTC-123/capestone-final/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/next.js-16-166432" alt="Next.js 16">
  <img src="https://img.shields.io/badge/react-19-166432" alt="React 19">
  <img src="https://img.shields.io/badge/node-22-166432" alt="Node 22">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-166432" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://ricer-ifrane.vercel.app"><b>Live demo</b></a> &nbsp;·&nbsp;
  <a href="docs/DEPLOYMENT.md"><b>Deploy (free tier)</b></a> &nbsp;·&nbsp;
  <a href="apps/web/docs/ARCHITECTURE.md">Architecture</a> &nbsp;·&nbsp;
  <a href="apps/web/docs/API.md">API</a> &nbsp;·&nbsp;
  <a href="docs/DEMO.md">Demo script</a> &nbsp;·&nbsp;
  <a href="docs/EVALUATION.md">Test results</a> &nbsp;·&nbsp;
  <a href="docs/README.md">Documentation</a>
</p>

---

**RICER** (Resilient Infrastructures and Coordinated Emergency Response) is a web platform for forest-fire response in Ifrane Province, Morocco. Reports from residents and field crews, the officials who assess and dispatch, and the agencies they coordinate with all work from one shared record.

It is a Computer Science capstone at Al Akhawayn University in Ifrane, supervised by Houda Chakiri.

## Two experiences, one record

| Residents (civic) | Officials (command centre) |
|---|---|
| Report a fire in three steps: place search, GPS or map pin; details; photos | Map-first operating picture: incidents, vehicles, infrastructure, NASA FIRMS, EFFIS, forest tracks and weather layers |
| Reports are saved on the phone first and sent automatically when the network returns | Conflict-free dispatch: TomTom routes with live traffic, reachable ranges and ETAs; atomic resource claims |
| Track your reports and their status | ICS roles, mutual aid, POI and PMA workflows, campaign checklists, debriefings |
| Clear emergency guidance (15 / 177) on every page | Model-backed fire-risk layer (partner team's XGBoost), fire-record verification, PDF export |
| Arabic (RTL), French and English | Access-request approvals and an audit trail of every sensitive action |

The civic experience uses a light "paper" theme; the command centre defaults to a dark "ops" theme. Both are available in either mode.

## Engineering highlights

- **Security, against selected OWASP ASVS 5.0 controls:**
  - server-side RBAC in a request proxy and on every API route;
  - sign-up can never grant the official role (approval workflow);
  - account lockout;
  - rotating refresh tokens with reuse detection;
  - rate limits (Upstash);
  - nonce-based strict CSP and security headers;
  - zod input validation;
  - photo uploads checked by file signature, with EXIF/GPS metadata stripped;
  - an append-only audit log.
- **Offline-first reporting:** an IndexedDB queue plus a service worker, with idempotent sync keyed by a client submission ID. It's tested so that retries, crashes and concurrent tabs never create duplicate reports.
- **Concurrency:** dispatch claims vehicles and teams with conditional atomic updates. An integration test fires twelve simultaneous assignments of one truck at a real MongoDB; exactly one succeeds.
- **Model integration:** the partner team's XGBoost model is evaluated in pure TypeScript. It matches the Python reference to about 1e-6, and reports its version, data time and an explicit "unavailable" state ([model card](apps/web/src/lib/risk/model/MODEL_CARD.md)).
- **Accessibility:** WCAG 2.2 AA checks (axe) on every route, on seven browser and device profiles including Arabic RTL.
- **Resilience:** a health endpoint with a per-dependency status, graceful degradation when an optional service is missing, and a rehearsed backup and restore ([runbook](docs/runbooks/backup-restore.md)).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind · Prisma 5 + MongoDB · MapLibre 6 + deck.gl · TomTom routing · NASA FIRMS · Upstash Redis/QStash · Vercel Blob · Ably · Resend · Twilio (WhatsApp sandbox) · Sentry

Free hosting: Vercel Hobby + MongoDB Atlas M0 + Upstash free tiers. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Quick start

Requires Node 22 LTS and Docker (for a local MongoDB replica set).

```bash
docker run -d --name ricer-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec ricer-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'

cd apps/web
cp .env.example .env.local        # set DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_PEPPER
npm ci
npx prisma db push && npm run prisma:seed
npm run dev                       # http://localhost:3000
```

Demo accounts (password `password123`): official **CD789012**, resident **AB123456**. With `DEMO_MODE=true`, the sign-in page also offers one-click personas. A 12-minute walkthrough is in [docs/DEMO.md](docs/DEMO.md).

## Tests

| Command | What it covers |
|---|---|
| `npm run test:unit` | Unit and integration tests (Vitest, about 1,840 tests) |
| `npm run test:db` | Real-MongoDB integration: auth hardening, token theft, dispatch race, idempotent reports and uploads |
| `npx playwright test tests/e2e/live` | The live app on 7 profiles (Chrome, Firefox, Safari, Pixel 7, iPhone 14, iPad Pro, Arabic RTL): every route, axe WCAG 2.2, overflow, offline reporting, RBAC |
| `npm run perf:k6` | Load at 10 / 25 / 50 concurrent users |
| `npm run lint` · `npm run typecheck` | Static checks |

## Repository layout

```
apps/web/        Next.js app: src, tests, Prisma schema, seed, perf, scripts
data/gis/        GIS source layers for Ifrane Province
scripts/gis/     GIS preparation (relief contours)
docs/            Deployment, runbooks, specifications, audits, research
.github/         CI (lint, unit, real-DB, build), security scanning (CodeQL, audit)
```

## Acknowledgements

Al Akhawayn University in Ifrane, School of Science and Engineering. Supervisor: Houda Chakiri. The wildfire-occurrence model is the work of the RICER machine-learning team (M. Erraisse, R. Souane, W. Hara). Data from NASA FIRMS, Copernicus EFFIS and CAMS, Open-Meteo, OpenStreetMap contributors and AWS Terrain Tiles.

## License

[MIT](LICENSE)
