import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { __resetRateLimits } from '@/lib/security/rateLimit';
import { signAccessToken } from '@/lib/auth';

export async function resetDb() {
  __resetRateLimits();
  // Delete children before parents.
  await prisma.auditLog.deleteMany();
  await prisma.notificationDelivery.deleteMany();
  await prisma.dispatch.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.team.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.report.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.officialRequest.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

export async function createUser(role: 'CIVILIAN' | 'OFFICIAL', cin: string, password = 'correct-horse-battery') {
  return prisma.user.create({
    data: { cin, phone: '+212600000000', password: await bcrypt.hash(password, 4), role, department: role === 'OFFICIAL' ? 'HCEFLCD' : undefined },
  });
}

export function bearer(user: { id: string; cin: string; role: 'CIVILIAN' | 'OFFICIAL' }) {
  return `Bearer ${signAccessToken({ userId: user.id, cin: user.cin, role: user.role })}`;
}

let ip = 0;
/** Each request gets its own client IP so rate limits don't couple tests. */
export function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  ip += 1;
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.0.${Math.floor(ip / 250)}.${ip % 250}`, ...headers },
    body: JSON.stringify(body),
  });
}

export function cookieFrom(response: Response, name: string): string | undefined {
  const all = response.headers.getSetCookie?.() ?? [];
  const match = all.find((c) => c.startsWith(`${name}=`));
  return match?.split(';')[0].slice(name.length + 1);
}
