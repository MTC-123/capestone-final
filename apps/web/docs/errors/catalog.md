# Error Catalog

This document is generated from the canonical catalog in src/lib/errors/catalog.ts.

## 1000 — CLIENT_BAD_REQUEST

- Severity: LOW
- HTTP status: 400
- Developer message: Bad request
- User message key: errorBadRequest

**Root causes**
- Malformed JSON
- Missing required parameters

**Resolution steps**
- Validate request payload format
- Ensure required fields are provided

**Remediation hints**
- Check request payload and retry.

## 1001 — CLIENT_VALIDATION_FAILED

- Severity: LOW
- HTTP status: 422
- Developer message: Validation failed
- User message key: errorValidationFailed

**Root causes**
- Invalid field values
- Missing required fields

**Resolution steps**
- Review field-level errors
- Provide valid values for all required fields

**Remediation hints**
- Fix the highlighted fields and retry.

## 1002 — CLIENT_RATE_LIMITED

- Severity: MEDIUM
- HTTP status: 429
- Developer message: Too many requests
- User message key: errorRateLimited

**Root causes**
- Repeated requests in a short time window

**Resolution steps**
- Back off and retry later
- Avoid repeated submissions

**Remediation hints**
- Wait a moment and retry.

## 1003 — CLIENT_NOT_FOUND

- Severity: LOW
- HTTP status: 404
- Developer message: Resource not found
- User message key: errorNotFound

**Root causes**
- Invalid resource identifier
- Resource deleted

**Resolution steps**
- Verify the identifier
- Check that the resource exists

**Remediation hints**
- Refresh the page or return to a valid screen.

## 2000 — AUTH_UNAUTHENTICATED

- Severity: MEDIUM
- HTTP status: 401
- Developer message: Authentication required
- User message key: errorUnauthenticated

**Root causes**
- Missing token
- Invalid token

**Resolution steps**
- Re-authenticate
- Clear cookies and sign in again

**Remediation hints**
- Sign in and retry.

## 2001 — AUTH_FORBIDDEN

- Severity: MEDIUM
- HTTP status: 403
- Developer message: Not authorized
- User message key: errorForbidden

**Root causes**
- Insufficient role/permissions

**Resolution steps**
- Verify user role
- Grant permissions if appropriate

**Remediation hints**
- Contact an administrator if you believe this is incorrect.

## 2002 — AUTH_INVALID_CREDENTIALS

- Severity: LOW
- HTTP status: 401
- Developer message: Invalid credentials
- User message key: errorInvalidCredentials

**Root causes**
- Wrong CIN
- Wrong password

**Resolution steps**
- Ensure CIN is correct
- Reset password if necessary

**Remediation hints**
- Verify your CIN and password and retry.

## 2003 — AUTH_SESSION_EXPIRED

- Severity: LOW
- HTTP status: 401
- Developer message: Session expired
- User message key: errorSessionExpired

**Root causes**
- Expired token
- Revoked session

**Resolution steps**
- Re-authenticate
- Update token expiration policy if needed

**Remediation hints**
- Sign in again.

## 3000 — BUSINESS_RULE_VIOLATION

- Severity: LOW
- HTTP status: 409
- Developer message: Business rule violation
- User message key: errorBusinessRule

**Root causes**
- Action not allowed in current state

**Resolution steps**
- Validate state transitions
- Update UI to prevent invalid actions

**Remediation hints**
- Review the action and try again.

## 3001 — BUSINESS_ALREADY_EXISTS

- Severity: LOW
- HTTP status: 409
- Developer message: Resource already exists
- User message key: errorAlreadyExists

**Root causes**
- Unique constraint violation

**Resolution steps**
- Check existing resources
- Handle duplicates gracefully

**Remediation hints**
- Use a different identifier or sign in.

## 4000 — EXTERNAL_SERVICE_FAILED

- Severity: HIGH
- HTTP status: 502
- Developer message: External service failure
- User message key: errorExternalService

**Root causes**
- Third-party API outage
- Network errors

**Resolution steps**
- Check provider status
- Retry with backoff
- Use fallback if available

**Remediation hints**
- Try again later.

## 4001 — EXTERNAL_TWILIO_FAILED

- Severity: HIGH
- HTTP status: 502
- Developer message: Twilio notification failed
- User message key: errorNotificationFailed

**Root causes**
- Twilio API error
- Invalid credentials
- Provider outage

**Resolution steps**
- Verify Twilio config
- Inspect provider error code
- Retry later

**Remediation hints**
- Try again later; the report may still be saved.

## 4002 — EXTERNAL_WEATHER_FAILED

- Severity: MEDIUM
- HTTP status: 502
- Developer message: Weather provider failed
- User message key: errorWeatherFailed

**Root causes**
- Weather API timeout
- Provider outage

**Resolution steps**
- Check provider status
- Retry later

**Remediation hints**
- Refresh later.

## 5000 — SYSTEM_UNEXPECTED

- Severity: CRITICAL
- HTTP status: 500
- Developer message: Unexpected server error
- User message key: errorServer

**Root causes**
- Unhandled exception

**Resolution steps**
- Inspect logs using requestId
- Add handling for the failure mode

**Remediation hints**
- Try again later.

## 5001 — SYSTEM_CONFIG_MISSING

- Severity: CRITICAL
- HTTP status: 500
- Developer message: Missing server configuration
- User message key: errorConfigMissing

**Root causes**
- Missing required environment variables

**Resolution steps**
- Set DATABASE_URL and JWT_SECRET
- Restart the server

**Remediation hints**
- Create .env.local from .env.example and restart the server.

## 5002 — SYSTEM_DATABASE_FAILED

- Severity: CRITICAL
- HTTP status: 500
- Developer message: Database operation failed
- User message key: errorServer

**Root causes**
- Database connectivity issue
- Query error

**Resolution steps**
- Check database connection
- Inspect Prisma errors in logs

**Remediation hints**
- Try again later.
