# ADR 0001: MapLibre + Provider Proxy Mapping Service

## Status

- Accepted

## Context

- The app previously used Leaflet + direct third-party basemap calls.
- The mapping roadmap requires WebGL rendering (MapLibre GL JS, EPSG:3857) and operational controls (auth, rate limiting, caching, retries, circuit breakers).
- Third-party services (NASA GIBS, NASA FIRMS, Copernicus EFFIS, OSM) have different quotas, latencies, and availability characteristics.

## Decision

- Use MapLibre GL JS on the frontend as the WebGL map engine.
- Introduce server-side provider proxy endpoints for tiles/WMS and layer metadata under `/api/map/**` and `/api/tiles/**`.
- Standardize error payloads using RFC 7807 Problem+json while retaining the existing `{ error: ... }` envelope.
- Enforce auth (JWT access tokens with refresh rotation), scope-based RBAC, and Redis-backed sliding-window rate limiting.
- Apply a shared outbound HTTP engine with retries + jitter and a per-provider circuit breaker.
- Add multi-tier caching behavior via headers (CDN/gateway) plus in-process LRU TTL for hot tiles.

## Consequences

- Provider keys (e.g., FIRMS) remain server-only and are never exposed to clients.
- Mapping performance becomes more predictable and observable (cache hit ratios, upstream health).
- Additional operational dependencies are introduced (Redis) for distributed limits.
