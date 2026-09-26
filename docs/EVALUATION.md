# Evaluation: requirements, tests and results

Results of 25 September 2026: local runs on the `overhaul` branch, then the live production deployment built from `main` (https://ricer-ifrane.vercel.app). Next.js 16.3.6, React 19.3, Node 22 LTS.

**Machine:** Apple M5, 24 GB RAM, local MongoDB 7 replica set in Docker.

The figures below come from this machine. They are not a capacity promise for the hosted free tier.

## Summary

| Suite | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | Pass |
| Lint | `npm run lint` | 0 errors; 38 warnings, all React Compiler advisories. CI caps warnings at 38, so no new ones can land |
| Unit and integration | `npm run test:unit` | **1,844 / 1,844 pass** (153 files) |
| Real-database integration | `npm run test:db` | **16 / 16 pass** |
| Live cross-device e2e (local) | `npx playwright test tests/e2e/live` | **172 pass, 25 skipped by design, 1 fail** → fixed and re-run (iPad: 26 / 26 pass) |
| Live cross-device e2e (**production**) | `E2E_BASE_URL=https://ricer-ifrane.vercel.app npx playwright test tests/e2e/live` | **171 / 171 pass**, 0 failures (tests that write data excluded) |
| Static security analysis | CodeQL `security-extended` on every pull request | **0 open alerts** in shipped code |
| Load | `npm run perf:k6` | **0 errors** in 14,001 requests; p95 ≤ 21 ms at 50 users |
| Dependency audit | `npm audit --omit=dev` | **0 vulnerabilities** (was 40 before the overhaul) |
| Production build | `next build` | Pass |

The 25 skipped cases are deliberate: each one-off check runs once, on Chromium only, instead of on all seven profiles. These are:
- form sign-in and the wrong-password message;
- the sign-up privilege test;
- the offline IndexedDB flow (Chromium engines only);
- the keyboard command palette, which is skipped on phones.

## Requirements matrix

### Security (selected OWASP ASVS 5.0 controls)

| Requirement | Evidence | Result |
|---|---|---|
| Server-side access control on pages | e2e: residents are kept out of official pages; anonymous visitors are redirected with a return path | Pass on 7 profiles |
| Server-side access control on APIs | e2e: residents get 403 from official APIs; unit tests on each route guard | Pass |
| Sign-up cannot grant privileges | db: *ignores a client-supplied OFFICIAL role*, *files an official-access request instead*; e2e: *signing up cannot grant official privileges* | Pass |
| Approval workflow | db: *promotes the applicant, revokes their sessions and is decided only once*; *forbids civilians and self-review* | Pass |
| Password storage | db: *stores bcrypt hashes, never the password* | Pass |
| Brute-force protection | db: *locks the account after 5 failures, even for the right password* | Pass |
| No account enumeration | db: *same answer for unknown CINs and wrong passwords*; e2e: wrong-credentials message | Pass |
| Session management | db: refresh tokens *rotate on use*; *tolerate a concurrent duplicate within the grace window (two tabs)*; *revoke every session when a rotated token is replayed (theft)* | Pass |
| Security headers and CSP | e2e: *pages ship a nonce-based CSP and hardening headers* | Pass on 7 profiles |
| Upload validation | db: *deduplicates uploads by idempotency key and refuses non-images*; unit: file-signature checks and EXIF stripping | Pass |
| Input validation | db: *rejects reports outside Morocco and photos the reporter does not own*; zod schemas on mutating routes | Pass |
| Supply chain | `npm audit --omit=dev`: 0; CI runs CodeQL, dependency review and a critical-level audit | Pass |
| No shared caching of signed-in data | unit: `cachePolicy.test.ts` checks every authenticated route; production: an anonymous request straight after an official's returns 401, not a CDN copy | Pass |
| No stack traces to clients | unit: `withApiHandler.test.ts`: a production error never includes a stack, whatever the request headers | Pass |

### Reliability and concurrency

| Requirement | Evidence | Result |
|---|---|---|
| Conflict-free dispatch | db: *assigns the vehicle exactly once under 12 concurrent requests* | Pass |
| Multi-vehicle dispatch is all-or-nothing | db: *is all-or-nothing when one of several vehicles is already taken* | Pass |
| Idempotent report submission | db: *creates exactly one report for 8 concurrent submissions with the same clientSubmissionId*; *rejects another user replaying someone else's submission id* | Pass |
| Offline-first reporting | e2e: *a report written offline is kept on the device and sent once the network returns*; unit: offline store, sync, triggers, queue hook | Pass |
| Road routing failover | unit: `tomtom.test.ts`: TomTom first (live traffic, truck-aware), GraphHopper next, then a straight-line estimate labelled `estimate` | Pass |
| Graceful degradation | `/api/health` reports each dependency and lists the active integrations; detections return an empty set with `X-Detection-Status: unavailable` when every source fails | Pass |
| Backup and restore | Rehearsed `mongodump` → restore into a clean database, with record counts compared ([runbook](runbooks/backup-restore.md)) | Pass |

### Model integration

| Requirement | Evidence | Result |
|---|---|---|
| XGBoost parity with the Python reference | unit: `xgboost-parity.test.ts`, 300 reference rows, within about 1e-6 | Pass |
| Missing inputs handled like XGBoost (`default_left`) | unit: `xgboost-missing.test.ts` | Pass |
| Explicit "unavailable" state, version and data time | unit: `api-predict.test.ts`, `api-grid.test.ts`, `riskService.test.ts` | Pass |

### Accessibility, internationalisation and devices

| Requirement | Evidence | Result |
|---|---|---|
| WCAG 2.2 A/AA (axe, serious and critical) on every route | e2e: public, resident and official routes on each profile | Pass |
| No horizontal scroll | e2e: overflow check on every route and profile. The iPad `/operations` overflow (long campaign title) was fixed; re-run 26/26 | Pass |
| Arabic RTL | e2e `arabic-rtl` project: direction and language follow the request; logical CSS properties throughout | Pass |
| Devices | Desktop Chrome, Firefox and Safari; Pixel 7; iPhone 14; iPad Pro 11; Arabic RTL | 28 cases each |

### Performance (k6, production build, 1,000 synthetic reports plus 100 incidents)

Each iteration:
- an official loads the operating picture: incidents, reports, dispatch teams and health;
- every tenth iteration, a resident files a report.

| Concurrent users | Duration | p95 latency | Threshold |
|---|---|---|---|
| 10 | 60 s | 18.9 ms | < 800 ms ✓ |
| 25 | 60 s | 20.9 ms | < 1,200 ms ✓ |
| 50 | 60 s | 20.5 ms | < 2,000 ms ✓ |

Totals across the run:
- **Requests:** 14,001 over 3,408 iterations, **0 failed**.
- **Reads:** p50 6 ms, p95 13.8 ms.
- **Report submissions:** p50 33 ms, p95 165 ms.

## Non-functional requirements (ISO/IEC 25010)

Every row below was checked on the production deployment on 26 September 2026, unless marked *local*.

| Quality | Requirement | Evidence | Status |
|---|---|---|---|
| **Performance** | p95 < 800 ms at 10 users, < 2 s at 50 users | k6 on the production build (*local*): p95 18.9 / 20.9 / 20.5 ms at 10 / 25 / 50 users, 0 errors in 14,001 requests | ✅ |
| | API endpoints stay fast | Contract sweep (*local*): 363 calls, internal p95 8 ms. Every production response carries `x-response-time-ms` | ✅ |
| | Map stays fluid | Animation runs in the deck.gl overlay (30 fps, no React re-renders); the camera is uncontrolled; marker sizes step with zoom; the risk surface and elevation tiles are capped by zoom | ✅ |
| **Scalability** | No per-server state | Serverless functions; rate limits and cache in Upstash Redis, shared by every instance (health reports `backend: upstash`); notifications delivered by QStash | ✅ |
| **Availability** | Degrades rather than fails | `/api/health` reports each dependency and integration. Satellite, weather and routing outages fall back to empty sets, polling or straight-line estimates | ✅ |
| | Uptime monitoring | No external monitor yet (UptimeRobot or Better Stack on `/api/health`, free) | ⚠️ open |
| **Reliability** | No duplicates, no lost work | Idempotent reports and uploads (real-DB tests); offline queue; atomic dispatch (12-way race test) | ✅ |
| | Retries | QStash retries notifications; the TomTom client retries 5xx once, then fails over to GraphHopper, then to an estimate | ✅ |
| **Recoverability** | Backup and restore | Production Atlas backed up in 5.8 s (40 KB); restored into a clean database in 1.4 s, 295 documents with matching counts | ✅ |
| | Scheduled backups (RPO) | Backups are run by hand (`npm run db:backup`); M0 has no automatic snapshots | ⚠️ open |
| **Security** | Access control | Contract sweep of all 88 routes as anonymous, resident and official: nothing public by accident; residents are refused official APIs | ✅ |
| | Transport and browser hardening | HSTS (2 years, preload), nonce-based CSP, `X-Frame-Options: DENY`, `nosniff`, referrer policy, permissions policy (production headers) | ✅ |
| | Abuse resistance | 10 failed sign-ins → `429` with `Retry-After`; account lockout after 5 failures; subscribe-only, role-scoped realtime tokens | ✅ |
| | No information leakage | No stack traces in production; signed-in data never CDN-cached (tests on every authenticated route) | ✅ |
| | Supply chain | 0 known production vulnerabilities; CodeQL on every pull request | ✅ |
| | Secret scanning | GitHub secret scanning is disabled by choice | ⚠️ owner decision |
| **Privacy** | Data minimisation | Photo EXIF/GPS stripped; residents see only their own reports; incident and infrastructure feeds carry no personal fields (checked) | ✅ |
| **Observability** | Traceable requests | Structured JSON logs with `requestId`, route, code, severity and duration; `x-request-id` on every response | ✅ |
| | Error tracking | Sentry is supported but not configured (`SENTRY_DSN`) | ⚠️ open |
| **Usability and accessibility** | WCAG 2.2 AA | axe on every route and on 7 browser and device profiles (171 / 171 on production); reduced motion respected on the map | ✅ |
| | Languages | Arabic (RTL), French, English | ✅ |
| **Compatibility** | Browsers and devices | Chrome, Firefox and Safari on desktop; Pixel 7; iPhone 14; iPad Pro | ✅ |
| **Maintainability** | Quality gates | CI runs lint (warning budget), types, 1,852 unit and integration tests, real-database tests, the build and CodeQL. Previews get their own database | ✅ |

## Defects found and fixed during evaluation

| Area | Defect | Fix |
|---|---|---|
| Security | Eleven signed-in API routes were cacheable by the CDN, so an anonymous visitor could receive an official's data | `Cache-Control: private` on every authenticated route, with a regression test over all of them |
| Security | A request header could make production errors return full stack traces | Stack traces only in local development; test inverted |
| Offline | Node 22 exposes `navigator` without `onLine` on the server, so pages rendered as offline and then hydrated online | One shared connectivity check that treats a missing `onLine` as online |
| Fire database | Cause, commune and search filters used SQL-only JSON filters and failed on MongoDB | Native nested-field matching, with literal (escaped) search text |
| Map | Infrastructure sub-filters had no effect; co-located markers hid each other; firebreaks stored as points never drew | Filters wired through; stations at the true point with vehicles and resources ringed around them |
| Satellite data | One satellite, a box around Ifrane town only, unpadded times ("25:1") | Three VIIRS satellites over the Middle Atlas for 48 h; correct times |
| Accessibility | Risk badge used white text on light risk colours | A readable text colour per risk level (WCAG AA) |
| Access control | Residents could read debriefings and equipment audits | Official-only, found by the contract sweep |
| Robustness | A missing record, an unknown agency or an empty FIRMS import returned 500 | Database not-found maps to 404 and bad ids to 400, for every route; validated input returns 422 with the field |
| Map performance | The pulse animation re-rendered the whole map 3 times a second, and every pan or zoom frame re-rendered it too | Animation inside the deck.gl overlay; uncontrolled camera |

## Known limits

- **Free-tier limits.** On Vercel Hobby and Atlas M0, cold starts and the shared M0 cluster add latency that the local figures above do not include. Re-run the e2e suite against the deployment:
  ```bash
  E2E_BASE_URL=https://YOUR-APP.vercel.app npx playwright test tests/e2e/live
  ```
- **Optional integrations.** Satellite detections, weather tiles, road routing, realtime updates, email and WhatsApp are each enabled by a free key ([DEPLOYMENT.md](DEPLOYMENT.md)). Until a key is set, the app shows the feature as unavailable.
- **React Compiler advisories.** 38 lint warnings remain, mostly effects that set a loading flag before fetching. They are safe as written and are being migrated.
