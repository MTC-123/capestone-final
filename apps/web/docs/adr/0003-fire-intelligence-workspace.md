# ADR 0003: Fire intelligence maps and public reporting (2026)

## Status

Accepted for the RICER capstone. Supersedes the single-renderer and third-party basemap assumptions in ADR 0001.

## Decision

- The command map uses MapLibre 6 with deck.gl 9's MapLibre adapter. Its first-level controls are **Field operations**, **Fire detection**, and **Prevention and risk**. Specialists can open individual controls. Field operations includes dispatch routes, teams, vehicles, equipment, aircraft, personnel, watchtowers, water points, stations, firebreaks, and forest roads.
- The official historical map uses OpenLayers Canvas rendering. It pages through all verified and locked records by ignition date, draws official points and perimeters, and compares two NASA GIBS dates with a swipe. A live GIBS WMS capabilities catalogue is searchable; fire-relevant layers are surfaced first. Satellite thermal observations must never be labeled as confirmed incidents.
- The public report starts without a map or an account. Observation type and a location or landmark are enough. GPS asks whether it marks the fire or the observer and records its accuracy radius. Manual map adjustment is optional. Reports are locally queued before network submission; only a server acknowledgement changes the state to received. An opaque receipt permits later status checks without exposing reporter details.
- Both map engines use the project-hosted Ifrane PMTiles basemap. A user-triggered offline download saves the archive, font ranges, sprites and MapLibre worker. NASA imagery remains online. Public OSM tile servers are not used for offline downloads.
- If WebGL is unavailable, the command route presents an incident list and a link to the report form.

## Source contracts and keys

| Source | Purpose | Key / deployment need | Status |
| --- | --- | --- | --- |
| Project-hosted Protomaps Ifrane extract | Basemap and offline map | No API key; host `/maps/ifrane.pmtiles` with HTTP range support | Bundled |
| NASA GIBS | Dated imagery and archive catalogue | No API key | Integrated; online |
| NASA FIRMS | Current VIIRS thermal observations | Free server-side `FIRMS_MAP_KEY` | Integrated; use NOAA-20/21 first for future continuity |
| Copernicus EFFIS | Fire weather and burned-area context | No key for public WMS | Integrated; upstream availability varies |
| Open-Meteo | Current weather and wind | No key for noncommercial capstone use | Integrated; free hosted API has noncommercial limits and no uptime guarantee |
| Project database | Incidents, dispatch, vehicles, facilities, reports, perimeters | Existing MongoDB deployment | Source of truth for operations |
| Self-hosted GraphHopper | Road routes | `GRAPHHOPPER_URL` if routing is deployed | Optional; straight-line estimate otherwise |
| Distributed rate limiter / photo store | Guest abuse protection and photos | `UPSTASH_REDIS_REST_*` and `BLOB_READ_WRITE_TOKEN` recommended for multiple server instances | Local fallback and MongoDB photo storage available |

For a real multi-agency service, arrange an uptime-backed weather source or self-host Open-Meteo, a shared rate limiter, durable photo storage, operations monitoring, and authority-approved incident data agreements. This capstone does not claim the free hosted services have an emergency-service SLA.

Official references: [GIBS time support](https://nasa-gibs.github.io/gibs-api-docs/access-basics/), [FIRMS free key](https://firms.modaps.eosdis.nasa.gov/api/map_key/), [EFFIS access](https://forest-fire.emergency.copernicus.eu/downloads-instructions), [Protomaps downloads](https://docs.protomaps.com/basemaps/downloads), [Open-Meteo terms](https://open-meteo.com/en/terms), [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/).

## Verification

- `npm run build` and `npm run typecheck` pass.
- `NODE_OPTIONS='--localstorage-file=/tmp/ricer-test-storage.json' npm run test:unit` passes with the installed Node 26 runtime; package target is Node 22.
- Production browser test: save the Ifrane package, disconnect, reload `/map`, and open `/report`. The local basemap and report form render offline. Network-only satellite imagery is unavailable while disconnected.

## Known limits

- The Ifrane extract covers a bounded area and has maximum zoom 14. Higher zooms scale its detail rather than adding roads.
- GIBS requested dates can return empty or cloud-covered imagery. The UI labels requested dates and layer availability; it does not claim every pixel is a verified acquisition.
- Operational feeds are not packaged into the offline download. The app warns that previously held data may be stale and retries when online.
