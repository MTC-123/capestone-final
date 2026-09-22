import { describe, expect, it, beforeEach } from 'vitest';
import { CircuitBreaker, getCircuitBreaker } from '@/lib/platform/circuitBreaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, openTimeoutMs: 1000, halfOpenMaxInFlight: 1 });
  });

  // ── closed state ──────────────────────────────────────────────────────────

  it('starts in closed state and allows requests', () => {
    expect(cb.canRequest(0)).toBe(true);
    expect(cb.snapshot(0).state).toBe('closed');
  });

  it('resets failure count on success while closed', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onSuccess(2);
    expect(cb.snapshot(2).failures).toBe(0);
    expect(cb.snapshot(2).state).toBe('closed');
  });

  // ── closed → open ─────────────────────────────────────────────────────────

  it('transitions to open after reaching the failure threshold', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    expect(cb.snapshot(1).state).toBe('closed');

    cb.onFailure(2); // 3rd failure — hits threshold
    expect(cb.snapshot(2).state).toBe('open');
    expect(cb.snapshot(2).failures).toBe(3);
  });

  it('denies requests while open', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2);
    expect(cb.canRequest(2)).toBe(false);
  });

  // ── open → half_open ──────────────────────────────────────────────────────

  it('transitions to half_open after the timeout elapses', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2); // opened at t=2

    // Still open just before timeout
    expect(cb.canRequest(1001)).toBe(false); // 1001 - 2 = 999 < 1000

    // Exactly at timeout boundary
    expect(cb.canRequest(1002)).toBe(true); // 1002 - 2 = 1000 >= 1000
    expect(cb.snapshot(1002).state).toBe('half_open');
  });

  // ── half_open → closed ────────────────────────────────────────────────────

  it('returns to closed on a successful probe', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2); // open at t=2

    // Advance past timeout to enter half_open
    cb.onHalfOpenRequestStart(1002);
    cb.onSuccess(1003);

    expect(cb.snapshot(1003).state).toBe('closed');
    expect(cb.snapshot(1003).failures).toBe(0);
    expect(cb.snapshot(1003).openedAtMs).toBeUndefined();
  });

  // ── half_open → open ──────────────────────────────────────────────────────

  it('re-opens on a failed probe in half_open', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2); // open at t=2

    cb.onHalfOpenRequestStart(1002);
    cb.onFailure(1003); // probe fails → re-open

    expect(cb.snapshot(1003).state).toBe('open');
    expect(cb.snapshot(1003).openedAtMs).toBe(1003);
  });

  // ── halfOpenMaxInFlight ───────────────────────────────────────────────────

  it('allows only halfOpenMaxInFlight concurrent probes', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2); // open at t=2

    // Now in half_open at t=1002
    expect(cb.canRequest(1002)).toBe(true);

    cb.onHalfOpenRequestStart(1002); // in-flight = 1

    // maxInFlight is 1, so next request should be denied
    expect(cb.canRequest(1002)).toBe(false);
  });

  it('allows another probe after an in-flight probe completes successfully', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2);

    cb.onHalfOpenRequestStart(1002);
    expect(cb.canRequest(1002)).toBe(false);

    cb.onSuccess(1003); // completes probe, resets to closed
    expect(cb.canRequest(1003)).toBe(true);
  });

  // ── snapshot accuracy ─────────────────────────────────────────────────────

  it('snapshot reflects halfOpenInFlight count', () => {
    cb.onFailure(0);
    cb.onFailure(1);
    cb.onFailure(2);

    expect(cb.snapshot(1002).halfOpenInFlight).toBe(0);
    cb.onHalfOpenRequestStart(1002);
    expect(cb.snapshot(1002).halfOpenInFlight).toBe(1);
  });

  it('onHalfOpenRequestStart is a no-op when not in half_open', () => {
    // closed state — should not change anything
    cb.onHalfOpenRequestStart(0);
    expect(cb.snapshot(0).halfOpenInFlight).toBe(0);
    expect(cb.snapshot(0).state).toBe('closed');
  });
});

describe('getCircuitBreaker', () => {
  it('returns the same instance for the same providerId', () => {
    const id = `singleton-test-${Date.now()}`;
    const a = getCircuitBreaker(id);
    const b = getCircuitBreaker(id);
    expect(a).toBe(b);
  });

  it('returns different instances for different providerIds', () => {
    const base = `factory-test-${Date.now()}`;
    const a = getCircuitBreaker(`${base}-a`);
    const b = getCircuitBreaker(`${base}-b`);
    expect(a).not.toBe(b);
  });
});
