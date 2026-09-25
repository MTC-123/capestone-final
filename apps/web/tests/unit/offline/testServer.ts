/**
 * A minimal in-memory stand-in for /api/uploads and /api/reports that
 * enforces the same idempotency contracts as the real routes:
 *  - POST /api/uploads with the same `key` returns the same {id, url} with
 *    duplicate:true instead of creating a new upload;
 *  - POST /api/reports with the same clientSubmissionId returns the
 *    original report with duplicate:true (200) instead of creating a new one.
 *
 * Installed in place of global fetch, so `fetchWithAuth` (and therefore
 * sync.ts) exercises real request/response plumbing.
 */

export interface RouteOverride {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Throw a network error (e.g. offline) instead of responding. */
  networkError?: boolean;
  /** How many matching calls this override applies to before reverting to default behaviour. Default 1. */
  times?: number;
}

export class FakeApiServer {
  uploadsByKey = new Map<string, { id: string; url: string }>();
  reportsByClientId = new Map<string, { id: string; referenceNumber: string }>();
  uploadCount = 0;
  reportCount = 0;
  /** Whether POST /api/auth/token (the refresh fetchWithAuth calls on a 401) succeeds. */
  refreshOk = false;

  calls: { url: string; method: string }[] = [];

  private overrides: { urlIncludes: string; override: Required<Pick<RouteOverride, 'times'>> & RouteOverride }[] = [];
  private originalFetch: typeof fetch = globalThis.fetch;

  install(): () => void {
    this.originalFetch = globalThis.fetch;
    globalThis.fetch = this.handle.bind(this) as typeof fetch;
    return () => {
      globalThis.fetch = this.originalFetch;
    };
  }

  /** Queue a one-off (or `times`-many) response/failure for the next call(s) whose URL contains `urlIncludes`. */
  queueOverride(urlIncludes: string, override: RouteOverride): void {
    this.overrides.push({ urlIncludes, override: { times: 1, ...override } });
  }

  private takeOverride(url: string): RouteOverride | undefined {
    const idx = this.overrides.findIndex((o) => url.includes(o.urlIncludes));
    if (idx === -1) return undefined;
    const entry = this.overrides[idx];
    const result = entry.override;
    entry.override = { ...entry.override, times: (entry.override.times ?? 1) - 1 };
    if ((entry.override.times ?? 0) <= 0) this.overrides.splice(idx, 1);
    return result;
  }

  private async handle(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const method = (init?.method ?? 'GET').toUpperCase();
    this.calls.push({ url, method });

    const override = this.takeOverride(url);
    if (override) {
      if (override.networkError) throw new TypeError('Failed to fetch');
      return new Response(JSON.stringify(override.body ?? {}), {
        status: override.status ?? 200,
        headers: { 'content-type': 'application/json', ...(override.headers ?? {}) },
      });
    }

    if (url.includes('/api/auth/token') && method === 'POST') {
      return new Response(null, { status: this.refreshOk ? 200 : 401 });
    }
    if (url.includes('/api/uploads') && method === 'POST') {
      return this.handleUpload(init);
    }
    if (url.includes('/api/reports') && method === 'POST') {
      return this.handleReport(init);
    }
    return jsonError(404, 1003, 'not found');
  }

  private async handleUpload(init?: RequestInit): Promise<Response> {
    const form = init?.body as FormData;
    const key = String(form.get('key') ?? '');
    const existing = this.uploadsByKey.get(key);
    if (existing) {
      return new Response(JSON.stringify({ id: existing.id, url: existing.url, duplicate: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    this.uploadCount += 1;
    const id = `u${this.uploadCount}`;
    const url = `/api/uploads/${id}`;
    this.uploadsByKey.set(key, { id, url });
    return new Response(JSON.stringify({ id, url, duplicate: false }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }

  private async handleReport(init?: RequestInit): Promise<Response> {
    const payload = JSON.parse(String(init?.body ?? '{}')) as { clientSubmissionId?: string };
    const clientSubmissionId = payload.clientSubmissionId ?? '';
    const existing = this.reportsByClientId.get(clientSubmissionId);
    if (existing) {
      return new Response(
        JSON.stringify({ report: { id: existing.id }, referenceNumber: existing.referenceNumber, duplicate: true }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    this.reportCount += 1;
    const id = `r${this.reportCount}`;
    const referenceNumber = `RPT-TEST-${this.reportCount}`;
    this.reportsByClientId.set(clientSubmissionId, { id, referenceNumber });
    return new Response(JSON.stringify({ report: { id }, referenceNumber, duplicate: false }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }
}

function jsonError(status: number, code: number, message: string, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: { code, message, userMessage: message } }), {
    status,
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
  });
}

export { jsonError };
