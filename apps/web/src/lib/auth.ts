import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

export type Role = 'CIVILIAN' | 'OFFICIAL';

export type Scope =
  | 'map:read'
  | 'map:write'
  | 'reports:read'
  | 'reports:write'
  | 'equipment:read'
  | 'equipment:write'
  | 'analytics:read'
  | 'coordination:read'
  | 'coordination:write'
  | 'admin';

export interface AccessTokenPayload {
  tokenUse: 'access';
  userId: string;
  cin: string;
  role: Role;
  department?: string;
  scopes: Scope[];
}

export interface RefreshTokenPayload {
  tokenUse: 'refresh';
  userId: string;
  jti: string;
  scopes: Scope[];
}

export function deriveScopes(role: Role): Scope[] {
  if (role === 'OFFICIAL') {
    return ['map:read', 'map:write', 'reports:read', 'reports:write', 'equipment:read', 'equipment:write', 'analytics:read'];
  }
  return ['map:read', 'reports:read', 'reports:write', 'analytics:read'];
}

function parseCookies(headerValue: string | null): Record<string, string> {
  if (!headerValue) return {};
  const out: Record<string, string> = {};
  const parts = headerValue.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function readBearerToken(request: Request): string | undefined {
  const value = request.headers.get('authorization');
  if (!value) return undefined;
  const [scheme, token] = value.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return undefined;
  return token?.trim() || undefined;
}

export function signAccessToken(payload: Omit<AccessTokenPayload, 'tokenUse' | 'scopes'> & { scopes?: Scope[] }): string {
  const scopes = payload.scopes ?? deriveScopes(payload.role);
  const full: AccessTokenPayload = { ...payload, tokenUse: 'access', scopes };
  return jwt.sign(full, getJwtSecret(), { expiresIn: '15m' });
}

export function signRefreshToken(payload: Omit<RefreshTokenPayload, 'tokenUse'>): string {
  const full: RefreshTokenPayload = { ...payload, tokenUse: 'refresh' };
  return jwt.sign(full, getJwtSecret(), { expiresIn: '30d' });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as AccessTokenPayload;
    if (decoded?.tokenUse !== 'access') return null;
    if (!Array.isArray(decoded.scopes)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as RefreshTokenPayload;
    if (decoded?.tokenUse !== 'refresh') return null;
    if (!decoded?.jti) return null;
    if (!Array.isArray(decoded.scopes)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function hashRefreshToken(token: string): string {
  const pepper = process.env.REFRESH_TOKEN_PEPPER ?? getJwtSecret();
  return crypto.createHmac('sha256', pepper).update(token).digest('hex');
}

export function buildAuthResponse(
  body: Record<string, unknown>,
  accessToken: string,
  refreshToken: string
): NextResponse {
  const response = NextResponse.json(body);
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  response.cookies.set('auth-token', accessToken, { ...base, maxAge: 60 * 15 });
  response.cookies.set('refresh-token', refreshToken, { ...base, maxAge: 60 * 60 * 24 * 30 });
  // Readable, non-sensitive hint used only to render the matching theme on
  // the server (civic vs ops). Authorization never relies on it.
  const role = (jwt.decode(accessToken) as { role?: Role } | null)?.role;
  if (role) {
    response.cookies.set('ricer-role', role, { ...base, httpOnly: false, maxAge: 60 * 60 * 24 * 30 });
  }
  return response;
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 15,
    path: '/',
  });
}

export async function getAccessToken(request?: Request): Promise<string | undefined> {
  if (request) {
    const bearer = readBearerToken(request);
    if (bearer) return bearer;
    const cookiesObj = parseCookies(request.headers.get('cookie'));
    return cookiesObj['auth-token'];
  }

  const cookieStore = await cookies();
  return cookieStore.get('auth-token')?.value;
}

export async function getRefreshToken(request?: Request): Promise<string | undefined> {
  if (request) {
    const cookiesObj = parseCookies(request.headers.get('cookie'));
    return cookiesObj['refresh-token'];
  }

  const cookieStore = await cookies();
  return cookieStore.get('refresh-token')?.value;
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
  cookieStore.delete('refresh-token');
  cookieStore.delete('ricer-role');
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth-token');
}

export async function getCurrentUser(request?: Request): Promise<AccessTokenPayload | null> {
  const token = await getAccessToken(request);
  if (!token) return null;
  return verifyAccessToken(token);
}

export function signToken(payload: Omit<AccessTokenPayload, 'tokenUse' | 'scopes'> & { scopes?: Scope[] }): string {
  return signAccessToken(payload);
}

export function verifyToken(token: string): AccessTokenPayload | null {
  return verifyAccessToken(token);
}

export type SessionUser = {
  id: string;
  cin: string;
  role: Role;
  department?: string | null;
};

const REFRESH_TOKEN_SECONDS = 60 * 60 * 24 * 30;

/**
 * Mints an access/refresh token pair and records the hashed refresh token.
 * Shared by sign-in, sign-up and the demo entry point.
 */
export async function issueSession(
  user: SessionUser,
  request: Request,
  opts: { refreshSeconds?: number } = {}
): Promise<{ accessToken: string; refreshToken: string }> {
  const { prisma } = await import('@/lib/prisma');
  const scopes = deriveScopes(user.role);
  const accessToken = signAccessToken({
    userId: user.id,
    cin: user.cin,
    role: user.role,
    department: user.department ?? undefined,
    scopes,
  });
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken({ userId: user.id, jti, scopes });
  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      jti,
      tokenHash: hashRefreshToken(refreshToken),
      scopes,
      expiresAt: new Date(Date.now() + (opts.refreshSeconds ?? REFRESH_TOKEN_SECONDS) * 1000),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
      userAgent: request.headers.get('user-agent')?.slice(0, 256) ?? undefined,
    },
  });
  return { accessToken, refreshToken };
}

export function toPublicUser(user: {
  id: string;
  cin: string;
  phone: string;
  role: Role;
  fullName?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    cin: user.cin,
    phone: user.phone,
    role: user.role,
    fullName: user.fullName ?? undefined,
    email: user.email ?? undefined,
    department: user.department ?? undefined,
    position: user.position ?? undefined,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
