// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { guestReceipt, issueGuestToken, requireGuestToken, validGuestReceipt } from '@/lib/security/guestReport';

afterEach(() => vi.unstubAllEnvs());

describe('guest report credentials', () => {
  it('binds the short-lived upload token and opaque receipt to one submission', async () => {
    vi.stubEnv('JWT_SECRET', 'guest-test-secret-of-sufficient-length');
    const submissionId = '3f693d47-bc54-479a-9224-32ec9e3e559b';
    const token = await issueGuestToken(submissionId);
    const request = new Request('http://localhost/api/public/uploads', { headers: { authorization: `Bearer ${token}` } });
    await expect(requireGuestToken(request, submissionId)).resolves.toBeUndefined();
    await expect(requireGuestToken(request, '4f693d47-bc54-479a-9224-32ec9e3e559b')).rejects.toThrow();
    const receipt = guestReceipt('65f000000000000000000001', submissionId);
    expect(validGuestReceipt(receipt, '65f000000000000000000001', submissionId)).toBe(true);
    expect(validGuestReceipt(receipt, '65f000000000000000000002', submissionId)).toBe(false);
  });
});
