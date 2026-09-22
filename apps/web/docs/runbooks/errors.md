# Error Handling Runbook

## Quick Triage
- Locate `x-request-id` from the client error response or browser devtools.
- Search server logs for `requestId` to find the full context, stack trace, and mapped `code`.
- Confirm the `code` category:
  - 1xxx: client/validation
  - 2xxx: authentication/authorization
  - 3xxx: business logic
  - 4xxx: external services
  - 5xxx: system/infrastructure

## What the Client Receives
- The API returns a JSON error envelope under `error`:
  - `code`, `severity`, `timestamp`, `requestId`
  - `userMessage` for display
  - `fields[]` for validation issues
  - `hint[]` for remediation
- `debug.stack` is only included in non-production or when `x-debug: 1` is explicitly set.

## What the Server Logs
- Every handled exception logs a structured JSON line with:
  - `requestId`, `route`, `method`, `code`, `severity`, `durationMs`
  - `error.name`, `error.message`, `error.stack`
  - `meta` (safe contextual metadata)

## Common Codes and Actions
### 5001 SYSTEM_CONFIG_MISSING
- Symptoms: Auth endpoints fail immediately.
- Root causes: missing `DATABASE_URL` / `JWT_SECRET`.
- Actions:
  - Verify environment variables in deployment.
  - Confirm `.env.local` exists in local development.
  - Restart the service after updating secrets.

### 5002 SYSTEM_DATABASE_FAILED
- Symptoms: Prisma queries failing.
- Actions:
  - Check database connectivity and credentials.
  - Verify MongoDB cluster health.
  - Inspect Prisma error in logs.

### 4002 EXTERNAL_WEATHER_FAILED
- Symptoms: Weather API requests fail with 502.
- Actions:
  - Check provider availability.
  - Retry with backoff; consider caching/fallback strategies.

### 1002 CLIENT_RATE_LIMITED
- Symptoms: 429 responses with `Retry-After`.
- Actions:
  - Confirm client is not auto-retrying too aggressively.
  - Increase window/threshold only after confirming abuse patterns.

## Escalation
- CRITICAL severity (5xxx) recurring: page on-call and create an incident.
- HIGH severity (4xxx) recurring: check provider status and fallbacks; escalate if sustained.

