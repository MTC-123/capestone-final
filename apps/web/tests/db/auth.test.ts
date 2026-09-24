import { beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { unset } from '@/lib/database/unset';
import { POST as signup } from '@/app/api/auth/signup/route';
import { POST as signin } from '@/app/api/auth/signin/route';
import { POST as refresh } from '@/app/api/auth/token/route';
import { PATCH as decide } from '@/app/api/admin/official-requests/[id]/route';
import { bearer, cookieFrom, createUser, jsonRequest, resetDb } from './helpers';

beforeEach(resetDb);

describe('registration cannot grant privileges (ASVS 8.2)', () => {
  it('ignores a client-supplied OFFICIAL role', async () => {
    const res = await signup(
      jsonRequest('/api/auth/signup', { cin: 'ZZ111111', phone: '0612345678', password: 'long-enough-pass', role: 'OFFICIAL' })
    );
    expect(res.status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { cin: 'ZZ111111' } });
    expect(user.role).toBe('CIVILIAN');
  });

  it('files an official-access request instead of granting the role', async () => {
    await signup(
      jsonRequest('/api/auth/signup', {
        cin: 'ZZ222222',
        phone: '0612345678',
        password: 'long-enough-pass',
        requestOfficial: { department: 'HCEFLCD', position: 'Forest guard' },
      })
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { cin: 'ZZ222222' }, include: { officialRequests: true } });
    expect(user.role).toBe('CIVILIAN');
    expect(user.officialRequests).toHaveLength(1);
    expect(user.officialRequests[0].status).toBe('PENDING');
  });

  it('stores bcrypt hashes, never the password', async () => {
    await signup(jsonRequest('/api/auth/signup', { cin: 'ZZ333333', phone: '0612345678', password: 'long-enough-pass' }));
    const user = await prisma.user.findUniqueOrThrow({ where: { cin: 'ZZ333333' } });
    expect(user.password).not.toContain('long-enough-pass');
    expect(user.password).toMatch(/^\$2[aby]\$12\$/);
  });
});

describe('sign-in hardening', () => {
  it('locks the account after 5 failures, even for the right password', async () => {
    await createUser('CIVILIAN', 'LK123456', 'the-right-password');
    for (let i = 0; i < 5; i++) {
      const res = await signin(jsonRequest('/api/auth/signin', { cin: 'LK123456', password: `wrong-${i}` }));
      expect(res.status).toBe(401);
    }
    const locked = await signin(jsonRequest('/api/auth/signin', { cin: 'LK123456', password: 'the-right-password' }));
    expect(locked.status).toBe(423);
    const audit = await prisma.auditLog.count({ where: { action: 'auth.locked' } });
    expect(audit).toBe(1);
  });

  it('gives the same answer for unknown CINs and wrong passwords', async () => {
    await createUser('CIVILIAN', 'EN123456', 'the-right-password');
    const unknown = await signin(jsonRequest('/api/auth/signin', { cin: 'NO999999', password: 'whatever-pass' }));
    const wrong = await signin(jsonRequest('/api/auth/signin', { cin: 'EN123456', password: 'whatever-pass' }));
    expect(unknown.status).toBe(wrong.status);
    const [a, b] = [await unknown.json(), await wrong.json()];
    expect(a.error.code).toBe(b.error.code);
  });
});

describe('refresh-token rotation', () => {
  async function signedInRefreshCookie() {
    await createUser('CIVILIAN', 'RT123456', 'the-right-password');
    const res = await signin(jsonRequest('/api/auth/signin', { cin: 'RT123456', password: 'the-right-password' }));
    return cookieFrom(res, 'refresh-token') as string;
  }
  const refreshWith = (token: string) =>
    refresh(new Request('http://localhost/api/auth/token', { method: 'POST', headers: { cookie: `refresh-token=${token}` } }));

  it('rotates on use', async () => {
    const first = await signedInRefreshCookie();
    const res = await refreshWith(first);
    expect(res.status).toBe(200);
    expect(cookieFrom(res, 'refresh-token')).not.toBe(first);
  });

  it('tolerates a concurrent duplicate within the grace window (two tabs)', async () => {
    const token = await signedInRefreshCookie();
    const [a, b] = await Promise.all([refreshWith(token), refreshWith(token)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(await prisma.refreshToken.count({ where: { revokedAt: { not: null } } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: unset('revokedAt') })).toBe(3);
  });

  it('revokes every session when a rotated token is replayed later (theft)', async () => {
    const token = await signedInRefreshCookie();
    await refreshWith(token);
    await prisma.refreshToken.updateMany({ where: { rotatedAt: { not: null } }, data: { rotatedAt: new Date(Date.now() - 5 * 60_000) } });

    const replay = await refreshWith(token);
    expect(replay.status).toBe(401);
    const live = await prisma.refreshToken.count({ where: unset('revokedAt') });
    expect(live).toBe(0);
  });
});

describe('official-access approval', () => {
  it('promotes the applicant, revokes their sessions and is decided only once', async () => {
    const reviewer = await createUser('OFFICIAL', 'OF123456');
    const applicant = await createUser('CIVILIAN', 'AP123456');
    await prisma.refreshToken.create({
      data: { userId: applicant.id, jti: 'j1', tokenHash: 'h1', scopes: [], expiresAt: new Date(Date.now() + 60_000) },
    });
    const req = await prisma.officialRequest.create({ data: { userId: applicant.id, department: 'Protection civile' } });

    const call = () =>
      decide(
        new Request(`http://localhost/api/admin/official-requests/${req.id}`, {
          method: 'PATCH',
          headers: { authorization: bearer(reviewer), 'content-type': 'application/json', 'x-forwarded-for': '10.9.9.9' },
          body: JSON.stringify({ decision: 'APPROVE' }),
        }),
        { params: { id: req.id } }
      );

    const [first, second] = await Promise.all([call(), call()]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);

    const promoted = await prisma.user.findUniqueOrThrow({ where: { id: applicant.id } });
    expect(promoted.role).toBe('OFFICIAL');
    expect(await prisma.refreshToken.count({ where: { userId: applicant.id, ...unset('revokedAt') } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: applicant.id, revokedAt: { not: null } } })).toBe(1);
  });

  it('forbids civilians and self-review', async () => {
    const civilian = await createUser('CIVILIAN', 'CV123456');
    const official = await createUser('OFFICIAL', 'SELF1234');
    const own = await prisma.officialRequest.create({ data: { userId: official.id, department: 'HCEFLCD' } });

    const asCivilian = await decide(
      new Request(`http://localhost/api/admin/official-requests/${own.id}`, {
        method: 'PATCH',
        headers: { authorization: bearer(civilian), 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE' }),
      }),
      { params: { id: own.id } }
    );
    expect(asCivilian.status).toBe(403);

    const selfReview = await decide(
      new Request(`http://localhost/api/admin/official-requests/${own.id}`, {
        method: 'PATCH',
        headers: { authorization: bearer(official), 'content-type': 'application/json' },
        body: JSON.stringify({ decision: 'APPROVE' }),
      }),
      { params: { id: own.id } }
    );
    expect(selfReview.status).toBe(403);
  });
});
