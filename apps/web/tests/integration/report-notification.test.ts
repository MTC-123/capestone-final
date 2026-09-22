/**
 * Integration Test: Report → WhatsApp Notification pipeline
 *
 * Covers the full POST /api/reports flow including:
 *   - Notification enqueue when Twilio is configured
 *   - Skip when Twilio is not configured
 *   - Non-blocking: report succeeds even when enqueue fails
 *   - Fallback to TEST_PHONE_NUMBER
 *   - No notification when no recipients
 *   - Officials cache within 5-min TTL
 *   - E.164 phone validation (Fix 1)
 *   - Message format
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// ============================================
// Shared mock state (survives vi.resetModules)
// ============================================

const mockIsTwilioConfigured = vi.fn(() => true);
const mockEnqueueNotification = vi.fn().mockResolvedValue(undefined);
const mockUserFindMany = vi.fn().mockResolvedValue([]);
const mockReportCreate = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockReportCount = vi.fn().mockResolvedValue(0);

// ============================================
// Mocks (re-registered after each resetModules)
// ============================================

function registerMocks() {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
  }));

  vi.doMock('@/lib/observability/logger', () => ({
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  }));

  vi.doMock('@/lib/observability/monitoring', () => ({
    captureException: vi.fn(),
  }));

  vi.doMock('@/lib/notifications/twilio', () => ({
    isTwilioConfigured: () => mockIsTwilioConfigured(),
  }));

  vi.doMock('@/lib/notifications/queue', () => ({
    enqueueNotification: (reportId: string, recipients: string[], message: string) =>
      mockEnqueueNotification(reportId, recipients, message),
  }));

  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      report: {
        create: (...args: unknown[]) => mockReportCreate(...args),
        findMany: vi.fn().mockResolvedValue([]),
        count: (...args: unknown[]) => mockReportCount(...args),
      },
      user: {
        findMany: (...args: unknown[]) => mockUserFindMany(...args),
      },
    },
  }));
}

// ============================================
// Helpers
// ============================================

function createRequest(url: string, body?: unknown, method = 'GET'): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function setupCivilianUser() {
  mockGetCurrentUser.mockResolvedValue({
    tokenUse: 'access',
    userId: 'user-civ-1',
    cin: 'CIV001',
    role: 'CIVILIAN' as const,
    scopes: ['map:read', 'reports:read', 'reports:write', 'analytics:read'],
  });
}

let reportCounter = 0;
function setupReportCreate() {
  mockReportCreate.mockImplementation((args: { data: Record<string, unknown> }) => {
    reportCounter++;
    return Promise.resolve({
      id: `report-${reportCounter}`,
      ...args.data,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: { cin: 'CIV001', phone: '+212600000099', role: 'CIVILIAN' },
    });
  });
}

const VALID_REPORT_BODY = {
  latitude: 33.55,
  longitude: -5.06,
  description: 'Smoke detected near forest',
  cause: 'NATURAL',
};

// ============================================
// Tests
// ============================================

describe('Report → WhatsApp Notification Integration', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    // Reset modules to clear the officials cache inside reports/route.ts
    vi.resetModules();
    registerMocks();

    vi.clearAllMocks();
    reportCounter = 0;
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TEST_PHONE_NUMBER;
    mockIsTwilioConfigured.mockReturnValue(true);
    mockEnqueueNotification.mockResolvedValue(undefined);
    mockUserFindMany.mockResolvedValue([]);
    setupCivilianUser();
    setupReportCreate();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  async function importPostHandler() {
    const mod = await import('@/app/api/reports/route');
    return mod.POST;
  }

  // ---- Core flow ----

  it('enqueues notification when Twilio is configured and officials exist', async () => {
    mockUserFindMany.mockResolvedValue([
      { phone: '+212600000001' },
      { phone: '+212600000002' },
    ]);

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledOnce();

    const [reportId, recipients, message] = mockEnqueueNotification.mock.calls[0];
    expect(reportId).toMatch(/^report-/);
    expect(recipients).toEqual([
      'whatsapp:+212600000001',
      'whatsapp:+212600000002',
    ]);
    expect(typeof message).toBe('string');
  });

  it('skips notification when Twilio is not configured', async () => {
    mockIsTwilioConfigured.mockReturnValue(false);
    mockUserFindMany.mockResolvedValue([{ phone: '+212600000001' }]);

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it('report succeeds even when enqueue fails (non-blocking)', async () => {
    mockUserFindMany.mockResolvedValue([{ phone: '+212600000001' }]);
    mockEnqueueNotification.mockRejectedValueOnce(new Error('Redis down'));

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.report).toBeDefined();
    expect(body.report.id).toBeDefined();
  });

  // ---- Fallback & no-recipient ----

  it('falls back to TEST_PHONE_NUMBER when no officials exist', async () => {
    process.env.TEST_PHONE_NUMBER = '+212611111111';
    mockUserFindMany.mockResolvedValue([]);

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledOnce();

    const recipients = mockEnqueueNotification.mock.calls[0][1];
    expect(recipients).toEqual(['whatsapp:+212611111111']);
  });

  it('sends no notification when no recipients at all', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  // ---- Officials cache ----

  it('uses cached officials within 5-min TTL', async () => {
    mockUserFindMany.mockResolvedValue([{ phone: '+212600000001' }]);

    const POST = await importPostHandler();

    // First report populates cache
    await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));
    const firstCallCount = mockUserFindMany.mock.calls.length;

    // Second report should use cache (no additional findMany call)
    await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));
    const secondCallCount = mockUserFindMany.mock.calls.length;

    expect(secondCallCount).toBe(firstCallCount);
  });

  // ---- E.164 validation (Fix 1) ----

  it('filters out invalid phone numbers via E.164 validation', async () => {
    mockUserFindMany.mockResolvedValue([
      { phone: '+212600000001' },   // valid
      { phone: '0600000002' },      // invalid: no +
      { phone: '+0600000003' },     // invalid: starts with 0
      { phone: '+1' },              // invalid: too short
      { phone: '' },                // invalid: empty
    ]);

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledOnce();

    const recipients = mockEnqueueNotification.mock.calls[0][1];
    expect(recipients).toEqual(['whatsapp:+212600000001']);
  });

  // ---- Message format ----

  it('notification message contains expected fields', async () => {
    mockUserFindMany.mockResolvedValue([{ phone: '+212600000001' }]);

    const POST = await importPostHandler();
    const res = await POST(createRequest('/api/reports', VALID_REPORT_BODY, 'POST'));

    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledOnce();

    const message: string = mockEnqueueNotification.mock.calls[0][2];
    expect(message).toContain('ALERTE INCENDIE');
    expect(message).toContain('33.55');
    expect(message).toContain('-5.06');
    expect(message).toContain('google.com/maps');
    expect(message).toContain('Smoke detected near forest');
    expect(message).toContain('CIV001');
    expect(message).toContain('Action requise');
  });
});
