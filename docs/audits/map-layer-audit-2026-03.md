# RICER Environmental Map Layer Audit

**Date:** 2026-03-06
**Branch:** firmls-updated
**Auditor:** RICER Dev Tools (automated)

---

## Summary

| # | Layer | Store Key | Default | Status |
|---|-------|-----------|---------|--------|
| 1 | Wind Vectors | `windVectors` | OFF | WORKING |
| 2 | Soil Moisture | `soilMoisture` | OFF | WORKING |
| 3 | Population Density | `populationDensity` | OFF | PARTIALLY WORKING |
| 4 | Fire Spread Prediction | `fireSpread` | OFF | WORKING |
| 5 | EFFIS Fire Weather Index | `effisFWI` | OFF | PARTIALLY WORKING |
| 6 | EFFIS Burned Areas | `effisBurnedAreas` | OFF | PARTIALLY WORKING |
| 7 | Fire Pressure (PAMF) | `pamfCommunes` | OFF | WORKING |
| 8 | Burned Area Ratio (RMA) | `rmaCommunes` | OFF | WORKING |
| 9 | CAMS Aerosol | `camsAerosol` | OFF | PARTIALLY WORKING |

---

## 1. Wind Vectors

**Classification: WORKING**

### Data Pipeline
- **Toggle:** `layers.windVectors` (store key `windVectors`, default OFF)
- **API endpoint:** `GET /api/weather/wind`
- **External API:** Open-Meteo Forecast API (`api.open-meteo.com/v1/forecast`)
  - Parameters: `current=wind_speed_10m,wind_direction_10m,wind_gusts_10m`
  - Grid: 5x5 points over Ifrane bbox `[33.0-34.0, -5.5 to -4.5]`
  - Multi-point query (25 lat/lon pairs joined by commas)
- **Cache:** In-memory, 30-minute TTL server-side
- **Response format:** GeoJSON `FeatureCollection` with Point features
  - Properties: `speed` (km/h), `direction` (degrees), `gusts` (km/h), `lat`, `lon`

### Rendering
- **MapLibre native layer** (`symbol` type)
- Source ID: `wind-vectors`, Layer ID: `wind-arrows`
- Custom SDF arrow image registered on map load via `createWindArrowImage(32)` -> `map.addImage('wind-arrow', img, { sdf: true })`
- Arrow rotated by `icon-rotate: ['get', 'direction']` with `icon-rotation-alignment: 'map'`
- Color-coded by speed: green (0-10 km/h) -> orange (15) -> red (25+)
- Interactive: included in `interactiveLayerIds`, hover shows tooltip

### Fetch Trigger
- `useEffect` triggers when `layers.windVectors` OR `layers.fireSpread` changes
- Clears data when both are OFF
- 30-minute polling interval when active

### Notes
- Open-Meteo is free, no API key required
- Solid implementation. Data format validated server-side with `isValidResponse()`
- Wind data is also consumed by the Fire Spread model (dual dependency)

---

## 2. Soil Moisture

**Classification: WORKING**

### Data Pipeline
- **Toggle:** `layers.soilMoisture` (default OFF)
- **API endpoint:** `GET /api/weather/soil-moisture`
- **External API:** Open-Meteo Forecast API
  - Parameters: `hourly=soil_moisture_0_to_1cm,...,soil_moisture_27_to_81cm`
  - Grid: 9x9 = 81 points over Ifrane bbox `[33.0-33.8, -5.6 to -4.8]`
  - Forecast 1 day, picks current-hour index
- **Cache:** In-memory, 5-minute TTL server-side
- **Response format:** GeoJSON FeatureCollection with Point features
  - Properties: `surface`, `root`, `deep` (m3/m3), `surfaceClass`, `rootClass`, `deepClass` (Dry/Low/Normal/Wet)

### Rendering
- **MapLibre native layer** (`circle` type)
- Source ID: `soil-moisture`, Layer ID: `soil-moisture-circles`
- Circle radius scales with zoom (8px at z8, 24px at z15)
- Color interpolated from brown (dry, <0.1) -> green (low) -> cyan (normal) -> blue (wet, >0.3)
- Active depth controlled by `soilMoistureDepth` store property (`surface` | `root` | `deep`)
- Interactive: hover shows tooltip

### Fetch Trigger
- `useEffect` triggers when `layers.soilMoisture` OR `layers.fireSpread` changes
- 5-minute polling interval when active
- Toast notification on API failure

### Notes
- Open-Meteo is free, no API key required
- Rate limiting handled with single retry after 2s delay
- Soil moisture data also consumed by Fire Spread model

---

## 3. Population Density

**Classification: PARTIALLY WORKING**

### Data Pipeline
- **Toggle:** `layers.populationDensity` (default OFF)
- **Primary source:** WorldPop ArcGIS ImageServer (remote raster tiles)
  - URL: `https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_Density_1km/ImageServer/exportImage?bbox={bbox-epsg-3857}&...&format=png&f=image`
  - 1km resolution, bbox-based WMS-style fetching
  - Bounds restricted to `[-5.6, 33.0, -4.8, 33.8]`, maxzoom 14
- **Fallback source:** Local JSON file `/data/ifrane-population-grid.json`
  - Synthetic census-estimated grid data
  - Rendered as heatmap layer when WorldPop tiles fail

### Rendering
- **Primary:** MapLibre `raster` layer (Source: `worldpop-density`, Layer: `worldpop-density-layer`)
  - Opacity: `populationDensityOpacity * 0.5`
- **Fallback:** MapLibre `heatmap` layer (Source: `population-density`, Layer: `population-density-heatmap`)
  - Heatmap weighted by `pop` property, color ramp yellow -> orange -> red -> dark red
  - Only visible when `!popTilesAvailable || !tierConfig.dataLimits.enableWMSOverlays`
- **Population at Risk badge** in incident popup via `usePopulationAtRisk` hook
  - Loads `/data/ifrane-population-grid.json` as module-level singleton cache
  - Sums population within 5km haversine radius of incident

### Issues
- **WorldPop ArcGIS endpoint is unreliable.** The `handleMapLoad` error handler detects tile failures and sets `popTilesAvailable = false`, falling back to local heatmap. This means the primary raster overlay frequently doesn't work.
- The fallback heatmap renders correctly but is synthetic data (not real satellite-derived density).
- On **Tier C GPUs**, `enableWMSOverlays` is false, so only the local heatmap is used regardless.
- The local grid file exists at `public/data/ifrane-population-grid.json` (confirmed).

---

## 4. Fire Spread Prediction

**Classification: WORKING**

### Data Pipeline
- **Toggle:** `layers.fireSpread` (default OFF)
- **No dedicated API endpoint.** Computation is entirely client-side.
- **Inputs (4 data sources merged):**
  1. **FIRMS detections** — recent fire points (from `/api/detections/combined`)
  2. **Incidents** — active incidents with status INTERVENTION or ALERTE
  3. **Wind data** — from `/api/weather/wind` (shared with wind vectors layer)
  4. **Soil moisture data** — from `/api/weather/soil-moisture` (shared with soil moisture layer)
  5. **Environment grid** — static file `/data/ifrane-environment-grid.json` (slope, aspect, fuel type)
- **Model:** Simplified Rothermel (1972) fire spread model (`src/lib/fire-spread/model.ts`)
  - Fuel base rates from ESA WorldCover land cover classes
  - Weighted circular mean of wind direction + slope aspect
  - Soil moisture dampens spread rate
  - Output: direction, relativeRate (0-1), riskLevel (low/moderate/high/extreme)
- **Hook:** `useFireSpreadVectors()` in `src/hooks/useFireSpreadVectors.ts`
  - Returns GeoJSON FeatureCollection with LineString (spread direction) + Point (arrowhead tip) features

### Rendering
- **MapLibre native layers** on Source `fire-spread-vectors`:
  1. `fire-spread-lines` (type: `line`) — spread direction arrows, width by relativeRate, color by riskLevel
  2. `fire-spread-tips` (type: `circle`) — arrowhead dots, filtered by `isTip === true`
- Color ramp: green (low) -> yellow (moderate) -> orange (high) -> red (extreme)
- Opacity controlled by `fireSpreadOpacity` (default 0.8)

### Fetch Trigger
- Activating `fireSpread` also triggers wind and soil moisture data fetching
- Environment grid loaded once (module-level singleton cache)

### Notes
- Depends on wind + soil moisture + FIRMS data being available
- If no active fires exist, no vectors are computed (expected behavior, not a bug)
- Static data file `ifrane-environment-grid.json` confirmed present

---

## 5. EFFIS Fire Weather Index (FWI)

**Classification: PARTIALLY WORKING**

### Data Pipeline
- **Toggle:** `layers.effisFWI` (default OFF)
- **No API proxy.** Direct WMS tile URL from MapLibre.
- **External source:** EFFIS WMS at `maps.effis.emergency.copernicus.eu`
  - Layer: `mf010.fwi` (ECMWF FWI forecast)
  - WMS 1.1.1, FORMAT=image/png, TRANSPARENT=true
  - SRS: **EPSG:3857** (correct for MapLibre)
  - TIME parameter: dynamic, based on `effisFwiDay` (0=today, up to +5 days)
  - BBOX: `{bbox-epsg-3857}` (MapLibre template)
- **Cache:** None (direct tile fetching by MapLibre)

### Rendering
- **MapLibre `raster` layer** (Source: `effis-fwi`, Layer: `effis-fwi-layer`)
- Source key changes with `effisFwiDay` to force tile reload
- Opacity controlled by `effisFwiOpacity` (default 0.6)
- Only rendered when `tierConfig.dataLimits.enableWMSOverlays && effisFwiTilesAvailable`

### Issues
- **EFFIS servers are frequently slow (5-10s per tile) or unreliable.** When tiles fail, `handleMapLoad` catches the error and sets `effisFwiTilesAvailable = false`, disabling the layer for the session.
- **No server-side proxy** — direct browser-to-EFFIS WMS. This means:
  - CORS issues possible (EFFIS does set CORS headers, but not always reliably)
  - No fallback data if EFFIS is down
  - No server-side caching
- **Tier C GPUs** skip this layer entirely (`enableWMSOverlays = false`)
- The WMS URL uses VERSION=1.1.1 with SRS=EPSG:3857 — this is correct (1.1.1 uses SRS, not CRS)
- FWI day selector (0-5) works correctly, regenerates tile URL via `useMemo`

### Reliability Assessment
- Works when EFFIS is responsive. Fails silently (transparent tiles) or disables itself when EFFIS is down.
- No retry mechanism. Once disabled, stays disabled until page reload.

---

## 6. EFFIS Burned Areas

**Classification: PARTIALLY WORKING**

### Data Pipeline
- **Toggle:** `layers.effisBurnedAreas` (default OFF)
- **Two parallel data sources:**

#### 6a. WMS Raster Tiles (direct)
- Layer: `modis.ba` (recent) or `modis.ba.season` (full season)
- Controlled by `effisBurnedAreaMode` (`'recent'` | `'season'`)
- WMS URL: `maps.effis.emergency.copernicus.eu/effis?SERVICE=WMS&VERSION=1.1.1&...&SRS=EPSG:3857&BBOX={bbox-epsg-3857}`
- Same reliability issues as EFFIS FWI above

#### 6b. WFS Vector Overlay (via API proxy)
- **API endpoint:** `GET /api/effis/burned-areas`
- **External:** EFFIS WFS 2.0.0 at `maps.effis.emergency.copernicus.eu/effis`
  - TYPENAMES: `burnt_areas_ha`
  - OUTPUTFORMAT: `application/json`
  - SRSNAME: EPSG:4326
  - BBOX: `33.0,-5.5,34.0,-4.5`
- **Cache:** In-memory, 1-hour TTL server-side
- **Response:** GeoJSON FeatureCollection (polygons of burned areas)
- **Rendering:** MapLibre `fill` + `line` layers (Source: `effis-burned-vector`)
  - Fill: `#7f1d1d` at 35% opacity
  - Outline: `#991b1b` at 70% opacity
  - Interactive: hover shows properties

### Fetch Trigger
- WFS vector data fetched when `layers.effisBurnedAreas` toggled on
- 1-hour polling interval
- WMS tiles loaded automatically by MapLibre when layer visible

### Issues
- **WMS raster tiles** have the same EFFIS reliability problem as FWI
- **WFS vector data:** The `burnt_areas_ha` layer may return empty FeatureCollection outside fire season — this is normal, not an error
- EFFIS WFS sometimes returns XML error instead of JSON — the API proxy handles this (checks content-type)
- **Note in code:** `effis.nrt.ba` is deprecated (PostGIS errors as of 2026)
- Both WMS and WFS channels controlled by the same toggle, which is good for redundancy

---

## 7. Fire Pressure (PAMF)

**Classification: WORKING**

### Data Pipeline
- **Toggle:** `layers.pamfCommunes` (default OFF)
- **Two data sources fetched in parallel:**
  1. **Static GeoJSON:** `/data/communes-ifrane.geojson` — commune boundary polygons with `areaKm2` and `forestedAreaHa` properties
  2. **API endpoint:** `GET /api/analytics/pamf-rma` (auth required: `analytics:read` scope)
     - Queries Prisma `fireEventRecord` collection
     - Aggregates fires per commune, computes `pamf` (fires/year) and `rma` (burned ha/year)
     - Returns `{ communes: CommuneStats[], hasData: boolean, yearSpan: number }`
- **Cache:** API has 30-minute in-memory TTL

### Rendering
- **MapLibre `fill` layer** (Source: `communes-pamf-rma`, Layer: `pamf-fill`)
- Choropleth: color interpolated by `pamf` property (fires per km2 per year)
  - 0 = green, 0.5 = yellow, 1.5 = orange, 3.0 = red
- When `hasData === false`, fills with gray (`PAMF_COLORS.noData`)
- Shared commune outlines (`communes-outline`) and labels (`communes-labels`)
- Interactive: hover shows commune name + PAMF value

### Client-side Processing
- After fetching both sources, merges stats into GeoJSON feature properties:
  - `pamf = (fires/year) / areaKm2`
  - Warns about GeoJSON/API commune name mismatches

### Notes
- Auth required (will fail for unauthenticated users — proper 401 response)
- Static GeoJSON file `communes-ifrane.geojson` confirmed present
- If no fire records exist in DB, shows "no data" state with info toast
- Commune data shared between PAMF and RMA layers (single Source)

---

## 8. Burned Area Ratio (RMA)

**Classification: WORKING**

### Data Pipeline
- Same as PAMF — shares the same fetch (`/api/analytics/pamf-rma` + `/data/communes-ifrane.geojson`)
- Toggle: `layers.rmaCommunes` (default OFF)
- Either PAMF or RMA toggle triggers the shared data fetch

### Rendering
- **MapLibre `fill` layer** (Source: `communes-pamf-rma`, Layer: `rma-fill`)
- Choropleth: color interpolated by `rma` property (burned % of forested area)
  - 0 = light blue, 0.1% = blue, 0.5% = violet, 1.0% = dark violet
- When `hasData === false`, fills with gray (`RMA_COLORS.noData`)
- Shares outlines and labels with PAMF layer

### Client-side Processing
- `rma = (burnedHa/year / forestedAreaHa) * 100` (percentage)
- Communes with 0 forested area get RMA = 0 (with console warning)

### Notes
- Identical reliability profile to PAMF
- Mutually exclusive display with PAMF (both can be on, but visually overlap since they share the same polygons — only the one on top is visible)

---

## 9. CAMS Aerosol

**Classification: PARTIALLY WORKING**

### Data Pipeline
- **Toggle:** `layers.camsAerosol` (default OFF)
- **API proxy:** `GET /api/cams/tiles?layer={wmsLayer}&bbox={bbox-epsg-3857}`
- **External source:** ECMWF ecCharts WMS at `eccharts.ecmwf.int/wms/`
  - WMS 1.3.0 with CRS=EPSG:4326
  - Token: `public` (hardcoded)
  - Styles: `sh_BuYlRd_aod`
  - Tile size: 256x256 PNG
- **Layer modes** (controlled by `camsAerosolMode`):
  - `'dust'` -> `composition_duaod550` (Dust AOD at 550nm) — default
  - `'smoke'` -> `composition_bbaod550` (Biomass Burning AOD)
  - `'aod'` -> `composition_aod550` (Total AOD)
- **Proxy handles:**
  - CORS avoidance (browser -> Next.js -> ECMWF)
  - EPSG:3857 -> EPSG:4326 coordinate conversion (correct for WMS 1.3.0 lat/lon bbox order)
  - XML error detection -> returns transparent 1px PNG fallback
  - Timeout: 20 seconds

### Rendering
- **MapLibre `raster` layer** (Source: `cams-aerosol`, Layer: `cams-aerosol-layer`)
- Source key changes with `camsAerosolMode` to force tile reload
- Opacity controlled by `camsAerosolOpacity` (default 0.6)
- Only rendered when `tierConfig.dataLimits.enableWMSOverlays`

### Issues
- **ECMWF ecCharts WMS is unreliable.** The service frequently returns XML errors or times out.
- The proxy gracefully handles failures by returning transparent tiles, so the layer "works" but shows nothing.
- **No visible error to the user** when ECMWF is down — tiles just appear transparent. Unlike EFFIS layers, there is no `camsAerosolTilesAvailable` state to disable the layer or show a toast.
- **Tier C GPUs** skip this layer entirely.
- The EPSG conversion math in the proxy is correct (3857 meters -> 4326 degrees).
- The WMS 1.3.0 bbox order (lat,lon for EPSG:4326) is correctly handled.

---

## Cross-Cutting Observations

### Heavy Raster Mutual Exclusivity
The store enforces mutual exclusivity for `HEAVY_RASTER_LAYERS`: `['ndvi', 'soilMoisture', 'effisFWI', 'camsAerosol', 'landCover']`. Enabling one auto-disables the others. This prevents GPU overload but means some combinations can't be viewed simultaneously.

### GPU Tier Gating
- **Tier A (WebGPU):** All layers available, animations enabled
- **Tier B (WebGL2):** All layers available, animations enabled
- **Tier C (fallback):** `enableWMSOverlays = false` — all WMS raster overlays disabled (EFFIS FWI, EFFIS Burned Areas WMS, CAMS Aerosol, NDVI, Land Cover, WorldPop, JRC Water, Slope). Only vector/GeoJSON layers work.

### Static Data Files (all confirmed present)
| File | Used By |
|------|---------|
| `public/data/communes-ifrane.geojson` | PAMF, RMA |
| `public/data/ifrane-population-grid.json` | Population Density (fallback), Population at Risk |
| `public/data/ifrane-environment-grid.json` | Fire Spread (slope, aspect, fuel) |
| `public/data/reservoirs.geojson` | Reservoirs |

### Missing Error Feedback
- CAMS Aerosol: No user-visible error when ECMWF is down (transparent tiles shown silently)
- EFFIS layers: Toast shown once, then layer disabled for session (no retry button)
- WorldPop: Toast shown on failure, but no "retry" or "use fallback" option visible to user

### Layers NOT Audited (out of scope — non-environmental)
- Incidents, Resources, Infrastructure, FIRMS Detections, Vehicles, Routes, Active Teams, Isochrones, Retardant, Forest Roads, Hillshade, Slope, Land Cover, NDVI, Reservoirs

---

## Action Items (Suggestions — not yet implemented)

1. **EFFIS FWI / Burned Areas:** Add server-side proxy (like CAMS) to handle CORS, caching, and error fallback. Currently direct browser-to-EFFIS which is fragile.
2. **CAMS Aerosol:** Add `camsAerosolTilesAvailable` state + toast notification when ECMWF is down, matching the EFFIS pattern.
3. **Population Density:** WorldPop ArcGIS endpoint is unreliable. Consider pre-downloading tiles or using a different source (SEDAC GPW v4).
4. **EFFIS Burned Areas WFS:** The `burnt_areas_ha` layer name should be verified against current EFFIS documentation — layer names have changed before.
5. **Session recovery:** When EFFIS/WorldPop tiles are disabled due to errors, there's no way to re-enable them without a page reload. Consider adding a retry mechanism.
