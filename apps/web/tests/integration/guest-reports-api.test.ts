import { beforeEach, describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();
const create = vi.fn();
const uploadCount = vi.fn();
const requireGuestToken = vi.fn();
const notifyEvent = vi.fn();

function mockDependencies() {
  vi.doMock('@/lib/prisma', () => ({ prisma: {
    report: { findUnique, create }, upload: { count: uploadCount },
  } }));
  vi.doMock('@/lib/security/rateLimit', () => ({ enforceRateLimit: vi.fn() }));
  vi.doMock('@/lib/security/guestReport', () => ({
    requireGuestToken,
    guestReceipt: () => 'opaque-receipt',
  }));
  vi.doMock('@/lib/notifications/events', () => ({ notifyEvent }));
  vi.doMock('@/lib/audit/log', () => ({ audit: vi.fn() }));
  vi.doMock('@/lib/observability/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
  vi.doMock('@/lib/observability/monitoring', () => ({ captureException: vi.fn() }));
}

const submissionId = '3f693d47-bc54-479a-9224-32ec9e3e559b';
const body = {
  clientSubmissionId: submissionId,
  observation: 'SMOKE',
  locationBasis: 'OBSERVER',
  latitude: 33.44,
  longitude: -5.23,
  description: '',
  capturedAt: '2026-09-26T10:00:00.000Z',
  images: [],
};

function request(payload: unknown) {
  return new Request('http://localhost/api/public/fire-reports', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer guest-token' },
    body: JSON.stringify(payload),
  });
}

describe('public fire report API', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks(); mockDependencies();
    findUnique.mockResolvedValue(null);
    uploadCount.mockResolvedValue(0);
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: '65f000000000000000000001', ...data }));
  });

  it('accepts a guest observer report into official triage with no user account', async () => {
    const { POST } = await import('@/app/api/public/fire-reports/route');
    const response = await POST(request(body));
    expect(response.status).toBe(201);
    expect(requireGuestToken).toHaveBeenCalledWith(expect.any(Request), submissionId);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      source: 'GUEST', observation: 'SMOKE', locationBasis: 'OBSERVER', status: 'PENDING', anonymous: true,
    }) }));
    expect(create.mock.calls[0][0].data.userId).toBeUndefined();
    expect(notifyEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'report.submitted' }));
    expect(await response.json()).toEqual(expect.objectContaining({ duplicate: false, receipt: 'opaque-receipt' }));
  });

  it('returns the same receipt for an idempotent retry', async () => {
    findUnique.mockResolvedValue({ id: '65f000000000000000000001', source: 'GUEST', clientSubmissionId: submissionId, referenceNumber: 'RPT-20260926-ABCD' });
    const { POST } = await import('@/app/api/public/fire-reports/route');
    const response = await POST(request(body));
    expect(response.status).toBe(200);
    expect(create).not.toHaveBeenCalled();
    expect(await response.json()).toEqual(expect.objectContaining({ duplicate: true, receipt: 'opaque-receipt' }));
  });

  it('rejects a photo that is not scoped to the submission', async () => {
    const { POST } = await import('@/app/api/public/fire-reports/route');
    const response = await POST(request({ ...body, images: ['/api/uploads/65f000000000000000000002'] }));
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(create).not.toHaveBeenCalled();
    expect(uploadCount).toHaveBeenCalledWith({ where: { id: { in: ['65f000000000000000000002'] }, guestSubmissionId: submissionId } });
  });
});
