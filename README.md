<p align="center">
  <img src="docs/assets/brand/banner.svg" alt="RICER Ifrane — wildfire reporting and response in Ifrane Province, Morocco" width="100%">
</p>

<p align="center">
  <a href="https://github.com/MTC-123/capestone-final/actions/workflows/ci.yml"><img src="https://github.com/MTC-123/capestone-final/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <img src="https://img.shields.io/badge/Next.js-16-166432" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-166432" alt="React 19">
  <img src="https://img.shields.io/badge/Node-22-166432" alt="Node 22">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-166432" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://ricer-ifrane.vercel.app"><strong>Open RICER</strong></a> ·
  <a href="https://ricer-ifrane.vercel.app/report">Report a fire or smoke</a> ·
  <a href="docs/DEMO.md">Demo guide</a> ·
  <a href="docs/DEPLOYMENT.md">Deployment guide</a>
</p>

# RICER Ifrane

RICER brings public fire reports, official incident assessment, dispatch, and historical fire data into one application for Ifrane Province, Morocco. A resident can report smoke without creating an account. An official can assess that report alongside field teams, vehicles, watchtowers, fire weather, and satellite observations. The archive keeps verified fires separate from thermal detections, which are observations rather than confirmed incidents.

This is a Computer Science capstone at Al Akhawayn University in Ifrane, supervised by Houda Chakiri. The name stands for **Resilient Infrastructures and Coordinated Emergency Response**.

## What you can do

### Report an observation

The [public report](https://ricer-ifrane.vercel.app/report) asks what you saw—fire, smoke, or unsure—and where you saw it. You can use a landmark, GPS, or an optional map adjustment. If you use GPS, the form asks whether the position marks the fire or *you*. Photos, a short description, and contact details are optional. A report saved without connectivity stays **queued** until the server acknowledges it; a receipt then lets you check its status. Reports enter an official triage queue and do not become confirmed incidents automatically.

### Work from a fire-focused command map

The command map groups its main controls around **Field operations**, **Fire detection**, and **Prevention and risk**. Field operations brings dispatch routes, teams, vehicles, equipment, watchtowers, water points, stations, firebreaks, and forest roads into one view. Task presets switch between active incidents, weather and spread, and satellite context. Specialists can still open individual layers.

The map uses MapLibre 6 and deck.gl for the live operating picture. Its Ifrane basemap is served from this project rather than a public tile server. Users can explicitly save the bounded Ifrane package for offline use; satellite imagery and live feeds still require a connection. If WebGL is unavailable, the incident list and report form remain usable.

### Investigate verified fire history

The official archive uses OpenLayers. It maps verified records and perimeters, filters by ignition date, and compares two dates of NASA GIBS imagery with a swipe. A short list surfaces fire-relevant imagery and environmental layers; the full NASA catalogue remains searchable for deeper work. The interface labels imagery dates and keeps satellite hotspots distinct from official fire records.

## Data, keys, and limits

| Source | Used for | Key |
|---|---|---|
| Project-hosted [Protomaps](https://docs.protomaps.com/basemaps/downloads) extract | Ifrane basemap and offline map | None |
| [NASA GIBS](https://nasa-gibs.github.io/gibs-api-docs/access-basics/) | Dated imagery and layer catalogue | None |
| [NASA FIRMS](https://firms.modaps.eosdis.nasa.gov/api/map_key/) | Recent satellite thermal observations | Free `FIRMS_MAP_KEY` |
| [Copernicus EFFIS](https://forest-fire.emergency.copernicus.eu/downloads-instructions) | Fire weather and burned-area context | None for public WMS |
| Open-Meteo | Weather and wind | None for noncommercial use, subject to provider limits |
| Project database | Reports, confirmed incidents, dispatch, vehicles, and facilities | `DATABASE_URL` |

The offline package covers Ifrane and nearby areas through zoom 14. It does not contain live operational feeds or NASA imagery. Hosted free data services do not provide an emergency-service uptime guarantee. See the [mapping runbook](apps/web/docs/runbooks/mapping.md) and [architecture decision](apps/web/docs/adr/0003-fire-intelligence-workspace.md) for source behavior and deployment needs.

## Under the hood

Next.js 16 · React 19 · TypeScript · Prisma 5 and MongoDB · MapLibre 6 and deck.gl for command · OpenLayers for history · PMTiles for the local basemap · NASA FIRMS and GIBS · Copernicus EFFIS · IndexedDB and a service worker for queued reports

The app also includes role-based access, an audit log, idempotent report submission, scoped guest upload tokens, and official verification before an incident enters the confirmed record. Dispatch uses conditional updates to prevent two concurrent claims on the same resource. The partner team's XGBoost fire-risk model runs in TypeScript and reports its version and data time ([model card](apps/web/src/lib/risk/model/MODEL_CARD.md)).

## Run it locally

Use Node 22 LTS and Docker for a local MongoDB replica set.

```bash
docker run -d --name ricer-mongo -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
docker exec ricer-mongo mongosh --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'

cd apps/web
cp .env.example .env.local
# Set DATABASE_URL, JWT_SECRET, and REFRESH_TOKEN_PEPPER in .env.local.
# Add FIRMS_MAP_KEY to enable live thermal detections.
npm ci
npx prisma db push
npm run prisma:seed
npm run dev
```

Open `http://localhost:3000`. The seed provides demo accounts: official **CD789012** and resident **AB123456**, both with password `password123`. `DEMO_MODE=true` adds one-click personas for a showcase deployment; leave it unset for real data. The [demo guide](docs/DEMO.md) walks through the application, and the [deployment guide](docs/DEPLOYMENT.md) covers hosting and environment variables.

## Check the work

Run commands from `apps/web`:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

The repository also has real-MongoDB integration tests (`npm run test:db`), browser tests (`npx playwright test tests/e2e/live`), and k6 workloads (`npm run perf:k6`). The [CI workflow](.github/workflows/ci.yml) runs lint, typecheck, unit tests, database integration tests, and a production build.

## Find your way around

| Path | Contents |
|---|---|
| [`apps/web`](apps/web) | Next.js application, API routes, tests, and Prisma schema |
| [`apps/web/docs`](apps/web/docs) | Architecture, API notes, and mapping decisions |
| [`docs`](docs) | Deployment, demo, research, evaluation, and runbooks |
| [`data/gis`](data/gis) | GIS source layers for Ifrane Province |
| [`.github/workflows`](.github/workflows) | CI and security checks |

## Credits and license

Built at Al Akhawayn University in Ifrane, School of Science and Engineering, under the supervision of Houda Chakiri. The wildfire-occurrence model is the work of the RICER machine-learning team: M. Erraisse, R. Souane, and W. Hara. Mapping and environmental data come from NASA FIRMS and GIBS, Copernicus EFFIS and CAMS, Open-Meteo, Protomaps, and OpenStreetMap contributors.

Licensed under [MIT](LICENSE).
