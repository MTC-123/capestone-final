# Mapping Service Runbook

## Symptoms
- Blank map tiles or missing overlays
- Elevated tile latency (p95)
- Spike in 429 responses
- Errors from upstream providers (502)

## First Checks
- Confirm `/api/auth/me` is 200 for the affected user/session.
- Confirm `/api/map/layers` returns 200.
- Hit one tile per provider:
  - `/api/tiles/osm/{z}/{x}/{y}`
  - `/api/tiles/gibs?...`
  - `/api/tiles/firms?...`
  - `/api/tiles/effis?...`

## Rate Limiting
- Mapping tile endpoints enforce a 200 req/min sliding window per user.
- If 429 rates increase, check Redis connectivity and the rate-limit keys for hot users/traffic patterns.

## Circuit Breakers
- If an upstream is failing, the circuit may open and return errors quickly until the open timeout elapses.
- Verify upstream status independently and confirm recovery after the open timeout.

## Caching
- `x-cache` indicates in-process hit/miss.
- CDN/gateway caching is controlled via `surrogate-control` and `cache-control`.
- If cache hit ratio drops, verify that requests are stable (query params, time, bbox) and that conditional requests (ETag) are used.

## Escalation
- Include `x-request-id` and providerId in the incident ticket.
- Attach 1-2 failing URLs and response headers.
