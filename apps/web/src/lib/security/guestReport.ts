import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { AppError } from '@/lib/errors/AppError';

function secret(): Uint8Array {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required for guest reports');
  return new TextEncoder().encode(process.env.JWT_SECRET);
}

export async function issueGuestToken(clientSubmissionId: string): Promise<string> {
  return new SignJWT({ clientSubmissionId, tokenUse: 'guest-report' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(secret());
}

export async function requireGuestToken(request: Request, clientSubmissionId: string): Promise<void> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError(2000);
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (payload.tokenUse !== 'guest-report' || payload.clientSubmissionId !== clientSubmissionId) throw new Error('scope mismatch');
  } catch {
    throw new AppError(2000);
  }
}

/** A deterministic secret so an idempotent retry can return the same receipt. */
export function guestReceipt(reportId: string, clientSubmissionId: string): string {
  return crypto.createHmac('sha256', secret()).update(`${reportId}:${clientSubmissionId}`).digest('base64url');
}

export function validGuestReceipt(value: string, reportId: string, clientSubmissionId: string): boolean {
  const actual = Buffer.from(value);
  const expected = Buffer.from(guestReceipt(reportId, clientSubmissionId));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
