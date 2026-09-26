# Mapping and fire-data runbook

## Blank basemap

1. Check `/maps/ifrane.pmtiles` returns HTTP 200 for a full request and HTTP 206 for a `Range: bytes=0-16383` request.
2. Check `/maplibre/maplibre-gl-worker.mjs`, `/maps/sprites/light.json`, and `/maps/fonts/Noto%20Sans%20Regular/0-255.pbf` return 200.
3. In a disconnected browser, verify the user selected **Save Ifrane for offline use** and that the UI showed completion. The service worker keeps the full PMTiles archive in `ricer-map-*` and serves byte ranges from it.
4. Check the browser map error and data-source banner. If WebGL is unavailable, `/map` should show the incident list and reporting link.

## Missing observations or imagery

- `/api/firms/detections` needs `FIRMS_MAP_KEY`. A successful empty response is possible when no thermal observation falls in the selected area and time.
- `/api/map/gibs-catalog` requires an official session. It reads NASA GIBS WMS capabilities; imagery requests go to NASA GIBS directly and require connectivity. Check the selected layer's time domain before comparing dates.
- `/api/effis/tiles`, `/api/effis/burned-areas`, and `/api/weather` rely on external services. An upstream error should appear as degraded data, while official incidents remain distinguishable from observations.
- `/api/fire-records?verifiedOnly=true&sortBy=ignitionAt` is paginated. The archive requests every page. If a record is absent, check its status and ignition-date filter first.

## Field operations

- The **Field operations** control activates routes, teams, vehicles, resources, watchtowers, stations, water points, firebreaks, and forest roads together. Individual switches remain under **Advanced layers**.
- Check `/api/geo/resources`, `/api/geo/infrastructure`, `/api/geo/vehicles`, `/api/dispatch/teams`, and routing configuration. `GRAPHHOPPER_URL` points to the preferred self-hosted road router; without a router the app uses estimates, which must not be presented as live road routes.

## Public reporting

- `/report` works without auth. A guest POST needs a submission-scoped token from `/api/public/report-session` and uses `/api/public/fire-reports`.
- Inspect the local queue state: **queued** means only IndexedDB has accepted the report; **received** means the server returned 201 or an idempotent 200. Reconnect and retry with the same `clientSubmissionId` to avoid duplicates.
- Guest photos must belong to the same submission and remain visible only to officials. Observer coordinates must be labeled as observer position and verified before incident creation.
