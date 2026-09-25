# Demo script (about 12 minutes)

Live site: **https://ricer-ifrane.vercel.app**. Every seeded account uses the password `password123`.

| Persona | CIN | One-click entry |
|---|---|---|
| Official: Karim Benali (command centre) | `CD789012` | `/demo/map?as=official` |
| Resident: Yasmine El Idrissi (citizen) | `AB123456` | `/demo/map?as=civilian` |

Before an audience:
- Open the site once a few minutes early. The free tier sleeps, and the first request wakes it up.
- Use two browser windows, one for each persona, so you never sign out on stage.

## 1. The problem, in one screen (1 min)

**Resident window**, landing page `/`.

Explain the gap: a fire is reported by phone, dispatch is coordinated by radio, and nobody shares one picture of the incident. RICER gives residents, officials and partner agencies one shared record.

## 2. A resident reports a fire, even offline (2 min)

Open `/report`.

1. Type **Dayet Aoua** in the place search and pick the result. The map flies there and drops a pin. You can also tap the map, or use GPS.
2. Add details and a photo. Location data (EXIF/GPS) is stripped from photos on upload.
3. **The offline moment:**
   - In DevTools → Network, choose **Offline**, then submit.
   - The report is kept on the phone and shows in the queue as waiting to send.
   - Switch back to **Online**. It is sent automatically, exactly once.
4. Show **Mes signalements**: the report is there with its status.

What to say:
- Mountain areas lose signal.
- Nothing typed is lost.
- A retry never creates a duplicate; each report carries its own submission ID.

## 3. The command centre (3 min)

**Official window**, `/map` (dark "ops" theme).

1. **Top strip:** today's risk level and the number of active incidents.
2. **Layers → Fire risk (model):**
   - The shaded surface is the partner team's XGBoost model.
   - It is evaluated live in the app and matches the Python reference to about 1e-6.
   - It uses Open-Meteo weather on a 0.1° grid.
3. **Layers → Satellite fire detections:**
   - These are real NASA FIRMS detections from the three VIIRS satellites over the last 48 hours.
   - The ones north of the province are real.
4. **Layers → Forest tracks:** 3,766 real forest tracks from OpenStreetMap. Crews reach fires on these.
5. **Layers → NDVI / EFFIS fire danger / Population:** vegetation stress, the European fire-danger index (Copernicus EFFIS) and population density, for context around an incident.
6. **Zoom in on Ifrane:**
   - The Protection Civile station sits at the centre, with its trucks, tanker and ambulance fanned out around it.
   - Hover a vehicle for its call sign and status.

## 4. Dispatch with real roads (2 min)

1. Click an active incident (orange), then **Déployer les véhicules** (*Dispatch vehicles*).
2. Pick a truck. The route comes from **TomTom with live traffic**, routed for a 12-tonne fire engine, with an ETA.
   - For example, the Ifrane station to Azrou is 18 km, about 25 minutes.
3. Turn on **Isochrones** to show where each unit can reach in 10, 20 and 30 minutes.
4. The concurrency point: if two officials dispatch the same truck at the same moment, only one succeeds. The other gets a clear "already assigned". This is tested with 12 simultaneous requests against a real database.

## 5. Coordination and the fire record (2 min)

- `/coordination`:
  - agency status board for Eaux et Forêts (DEF), Protection Civile, Gendarmerie Royale, FAR, Forces Royales Air, Forces Auxiliaires and the local authorities;
  - ICS roles;
  - mutual aid;
  - POI and PMA aviation workflows.
- `/operations`: the six operational phases of the campaign, with checklists.
- `/fire-database`:
  - filter by cause (e.g. **Négligence**) and commune (**Azrou**);
  - sort by burnt area;
  - tick two records and **Compare**;
  - open a record to show its verification, section locks and audit trail.
- `/analytics`: switch between 7 days, the season and the year; open the causes and response-time panels.

## 6. Trust and governance (1.5 min)

1. `/admin/approvals`:
   - Two people have asked for official access.
   - Sign-up can never grant the official role; an existing official must approve.
   - Approve one.
2. `/admin/audit`:
   - The approval you just made is the newest entry.
   - Filter by result **Refusé** to show actions the system blocked.
3. Security in one sentence:
   - server-side access control on every page and API;
   - rotating session tokens with theft detection;
   - nonce-based CSP;
   - private caching of signed-in data;
   - CodeQL on every pull request.

## 7. Built for Morocco (30 s)

- Switch the language to **العربية**. The whole interface mirrors right-to-left.
- Toggle light/dark.
- Resize to a phone: every screen is tested on iPhone, Pixel and iPad.

## Numbers to quote

Full results are in [EVALUATION.md](EVALUATION.md).

| Area | Result |
|---|---|
| Automated tests | 1,844 unit and integration tests; 16 real-database tests |
| Live end-to-end on production | 171 passing on 7 browser and device profiles, with WCAG 2.2 AA checks on every route |
| Load | 0 errors in 14,001 requests; p95 about 21 ms at 50 concurrent users |
| Dependencies | 0 known vulnerabilities in production dependencies |

## After the demo: reset the data

The demo changes live data: approvals, dispatches and reports. To restore the seeded state, run this from `apps/web` with the production `DATABASE_URL`:

```bash
npx tsx --env-file=.env.vercel prisma/seed.ts
```
