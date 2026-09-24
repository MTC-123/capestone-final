import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  deliver: vi.fn(),
}));

vi.mock('@upstash/qstash', () => ({
  Receiver: vi.fn().mockImplementation(() => ({
    verify: (...args: unknown[]) => mocks.verify(...args),
  })),
}));

vi.mock('@/lib/notifications/deliver', () => ({
  deliver: (...args: unknown[]) => mocks.deliver(...args),
}));

vi.mock('@/lib/observability/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from '@/app/api/notifications/deliver/route';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/notifications/deliver', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/notifications/deliver', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, QSTASH_CURRENT_SIGNING_KEY: 'current', QSTASH_NEXT_SIGNING_KEY: 'next' };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('rejects with 401 when the signing keys are not configured', async () => {
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;

    const res = await POST(request({ deliveryId: 'd1' }, { 'upstash-signature': 'sig' }));

    expect(res.status).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the signature header is missing', async () => {
    const res = await POST(request({ deliveryId: 'd1' }));
    expect(res.status).toBe(401);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it('rejects with 401 when the signature does not verify', async () => {
    mocks.verify.mockResolvedValue(false);
    const res = await POST(request({ deliveryId: 'd1' }, { 'upstash-signature': 'bad-sig' }));
    expect(res.status).toBe(401);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('rejects with 401 when verification throws (e.g. malformed signature)', async () => {
    mocks.verify.mockRejectedValue(new Error('invalid signature'));
    const res = await POST(request({ deliveryId: 'd1' }, { 'upstash-signature': 'garbage' }));
    expect(res.status).toBe(401);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });

  it('delivers and returns 200 on a valid signature', async () => {
    mocks.verify.mockResolvedValue(true);
    mocks.deliver.mockResolvedValue({ ok: true });

    const res = await POST(request({ deliveryId: 'delivery-1' }, { 'upstash-signature': 'good-sig' }));

    expect(res.status).toBe(200);
    expect(mocks.deliver).toHaveBeenCalledWith('delivery-1');
  });

  it('returns 500 on a retryable delivery failure so QStash retries', async () => {
    mocks.verify.mockResolvedValue(true);
    mocks.deliver.mockResolvedValue({ ok: false, error: 'temporary failure' });

    const res = await POST(request({ deliveryId: 'delivery-1' }, { 'upstash-signature': 'good-sig' }));

    expect(res.status).toBe(500);
  });

  it('returns 200 (no retry) when the delivery is terminally not found', async () => {
    mocks.verify.mockResolvedValue(true);
    mocks.deliver.mockResolvedValue({ ok: false, error: 'not_found' });

    const res = await POST(request({ deliveryId: 'missing' }, { 'upstash-signature': 'good-sig' }));

    expect(res.status).toBe(200);
  });

  it('returns 400 when the body has no deliveryId', async () => {
    mocks.verify.mockResolvedValue(true);
    const res = await POST(request({}, { 'upstash-signature': 'good-sig' }));
    expect(res.status).toBe(400);
    expect(mocks.deliver).not.toHaveBeenCalled();
  });
});
