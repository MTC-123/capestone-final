export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

export type CircuitBreakerConfig = {
  failureThreshold: number;
  openTimeoutMs: number;
  halfOpenMaxInFlight: number;
};

export type CircuitBreakerSnapshot = {
  state: CircuitBreakerState;
  failures: number;
  openedAtMs?: number;
  halfOpenInFlight: number;
};

export class CircuitBreaker {
  private readonly config: CircuitBreakerConfig;
  private state: CircuitBreakerState = 'closed';
  private failures = 0;
  private openedAtMs: number | undefined;
  private halfOpenInFlight = 0;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      failureThreshold: config?.failureThreshold ?? 5,
      openTimeoutMs: config?.openTimeoutMs ?? 30_000,
      halfOpenMaxInFlight: config?.halfOpenMaxInFlight ?? 1,
    };
  }

  snapshot(nowMs = Date.now()): CircuitBreakerSnapshot {
    this.advance(nowMs);
    return {
      state: this.state,
      failures: this.failures,
      openedAtMs: this.openedAtMs,
      halfOpenInFlight: this.halfOpenInFlight,
    };
  }

  canRequest(nowMs = Date.now()): boolean {
    this.advance(nowMs);
    if (this.state === 'closed') return true;
    if (this.state === 'open') return false;
    return this.halfOpenInFlight < this.config.halfOpenMaxInFlight;
  }

  onSuccess(nowMs = Date.now()) {
    this.advance(nowMs);
    if (this.state === 'half_open') {
      this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      this.state = 'closed';
      this.failures = 0;
      this.openedAtMs = undefined;
      return;
    }
    this.failures = 0;
  }

  onFailure(nowMs = Date.now()) {
    this.advance(nowMs);
    if (this.state === 'half_open') {
      this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      this.state = 'open';
      this.openedAtMs = nowMs;
      return;
    }
    this.failures += 1;
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
      this.openedAtMs = nowMs;
    }
  }

  onHalfOpenRequestStart(nowMs = Date.now()) {
    this.advance(nowMs);
    if (this.state !== 'half_open') return;
    this.halfOpenInFlight += 1;
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.openedAtMs = undefined;
    this.halfOpenInFlight = 0;
  }

  private advance(nowMs: number) {
    if (this.state !== 'open') return;
    if (this.openedAtMs === undefined) return;
    if (nowMs - this.openedAtMs < this.config.openTimeoutMs) return;
    this.state = 'half_open';
    this.failures = 0;
    this.halfOpenInFlight = 0;
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(providerId: string): CircuitBreaker {
  const existing = breakers.get(providerId);
  if (existing) return existing;
  const created = new CircuitBreaker();
  breakers.set(providerId, created);
  return created;
}
