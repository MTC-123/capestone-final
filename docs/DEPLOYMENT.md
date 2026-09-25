# Deploying RICER on free infrastructure

This guide puts the app on **Vercel Hobby + MongoDB Atlas M0 + Upstash**, all on free tiers. Every account below is free. Only the Twilio WhatsApp sandbox asks for a card.

The app degrades gracefully: anything marked *optional* can be added later, and the feature it powers shows as "unavailable" until then.

## 1. Accounts and keys

| # | Service | Why | Env vars | Required |
|---|---|---|---|---|
| 1 | [Vercel](https://vercel.com/signup) (Hobby) | Hosting | — | **Yes** |
| 2 | [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) M0 | Database | `DATABASE_URL` | **Yes** |
| 3 | Generated locally | Session signing | `JWT_SECRET`, `REFRESH_TOKEN_PEPPER` | **Yes** |
| 4 | [Upstash](https://console.upstash.com) Redis | Shared rate limits and cache across serverless instances | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Recommended |
| 5 | Upstash QStash | Notification delivery with retries | `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Recommended |
| 6 | Vercel Blob (Storage tab) | Report photos (otherwise stored in MongoDB) | `BLOB_READ_WRITE_TOKEN` | Recommended |
| 7 | [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/) | Satellite fire detections | `FIRMS_MAP_KEY` | Optional |
| 8 | [OpenWeatherMap](https://home.openweathermap.org/users/sign_up) | Weather overlay | `NEXT_PUBLIC_OWM_API_KEY` | Optional |
| 9 | [TomTom](https://developer.tomtom.com/user/register) | Road routes with live traffic, ETAs and reachable ranges (otherwise straight-line estimates) | `TOMTOM_API_KEY` | Optional |
| 9b | [GraphHopper](https://graphhopper.com/dashboard/#/register) Cloud | Backup routing provider if TomTom fails | `GRAPHHOPPER_API_KEY` | Optional |
| 10 | [Ably](https://ably.com/sign-up) | Live in-app updates | `ABLY_API_KEY` | Optional |
| 11 | [Resend](https://resend.com/signup) | Email notifications | `RESEND_API_KEY` | Optional |
| 12 | [Twilio](https://www.twilio.com/try-twilio) WhatsApp sandbox | WhatsApp alerts. Each recipient first sends the join code; the sandbox session lasts 72 h | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER` | Optional (card) |
| 13 | [Sentry](https://sentry.io/signup/) | Error tracking | `SENTRY_DSN` | Optional |
| 14 | [LocationIQ](https://locationiq.com/register) | Arabic and French place search | `LOCATIONIQ_API_KEY` | Optional |

Generate the two secrets with:

```bash
openssl rand -hex 48
```

Run it twice, once for each secret.

## 2. Database (Atlas M0)

1. Create a free **M0** cluster on AWS **eu-west-3 (Paris)**, next to the Vercel functions (`cdg1` in `vercel.json`).
2. Under **Database Access**, add a user with read/write on the `ricer` database.
3. Under **Network Access**, allow `0.0.0.0/0`. Vercel's egress IPs aren't fixed, so access is protected by the credentials.
4. Copy the connection string and add `/ricer`: `mongodb+srv://USER:PASS@cluster.mongodb.net/ricer?retryWrites=true&w=majority`.
5. From `apps/web`, push the schema and load the demo data:

   ```bash
   DATABASE_URL="…" npx prisma db push
   DATABASE_URL="…" SEED_ALLOW_PRODUCTION=true NODE_ENV=production npm run prisma:seed
   ```

M0 has no automated backups. Run `npm run db:backup` on a schedule; the procedure is in [runbooks/backup-restore.md](runbooks/backup-restore.md). M0 clusters also pause after 30 days without traffic.

## 3. Vercel project

1. **Add New → Project →** import the GitHub repository.
2. Set **Root Directory** to `apps/web`. The framework is detected as Next.js.
3. Add the environment variables from section 1 for Production and Preview. Set `BASE_URL` to the production URL. For the public showcase, also set `DEMO_MODE=true`.
4. Deploy, then check:

   ```bash
   curl https://YOUR-APP.vercel.app/api/health
   ```

   Expect `"status":"healthy"`, or `"degraded"` if Upstash isn't configured yet. The `integrations` block lists which optional services are active.

## 4. After deploying

- Visit `/demo/map?as=official` (demo mode only) to sign in as the seeded official.
- Run the live end-to-end suite against the deployment:

  ```bash
  E2E_BASE_URL=https://YOUR-APP.vercel.app npx playwright test tests/e2e/live
  ```

- Optional: add an UptimeRobot or Better Stack monitor on `/api/health`.

## Security notes

- `DEMO_MODE` must be unset on any deployment holding real data. It enables one-click persona sign-in.
- Officials are created only by approving an access request (`/admin/approvals`). Sign-up never grants the role.
- Rotate `JWT_SECRET` and `REFRESH_TOKEN_PEPPER` to invalidate every session.
