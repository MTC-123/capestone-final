import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Request proxy (Next.js 16's successor to middleware; runs on Node.js):
 *  1. Server-side gate for app pages. Anonymous visitors are redirected to
 *     /signin before any protected markup is sent, and civilians never
 *     receive official-only pages. API routes still enforce roles themselves;
 *     this layer only decides which pages are served.
 *  2. Per-request nonce and a strict Content-Security-Policy (script-src only
 *     runs scripts carrying the nonce), plus the remaining security headers.
 */

const PROTECTED_PREFIXES = [
  '/map',
  '/analytics',
  '/report',
  '/reports-list',
  '/weather',
  '/equipment',
  '/coordination',
  '/operations',
  '/fire-database',
  '/admin',
];

const OFFICIAL_PREFIXES = ['/equipment', '/coordination', '/operations', '/fire-database', '/admin'];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type TokenClaims = { role?: string; tokenUse?: string };

async function readAccessClaims(token: string | undefined): Promise<TokenClaims | null> {
  const secret = process.env.JWT_SECRET;
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] });
    return (payload as TokenClaims).tokenUse === 'access' ? (payload as TokenClaims) : null;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production';
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    // MapLibre, Recharts and Radix set inline style attributes.
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'font-src': ["'self'", 'data:', 'https:'],
    // Map tiles, open data services, realtime and error reporting. data:/blob:
    // are needed because deck.gl loads its inline SVG icons through fetch().
    'connect-src': ["'self'", 'https:', 'wss:', 'data:', 'blob:', ...(isDev ? ['ws:', 'http://localhost:*'] : [])],
    'worker-src': ["'self'", 'blob:'],
    'child-src': ["'self'", 'blob:'],
    'frame-src': ["'none'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'manifest-src': ["'self'"],
  };
  const policy = Object.entries(directives).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (!isDev) policy.push('upgrade-insecure-requests');
  return policy.join('; ');
}

function applySecurityHeaders(response: NextResponse, csp: string) {
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), geolocation=(self), microphone=(), payment=(), usb=()');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  if (matches(pathname, PROTECTED_PREFIXES)) {
    const claims = await readAccessClaims(request.cookies.get('auth-token')?.value);
    const hasRefresh = Boolean(request.cookies.get('refresh-token')?.value);

    if (!claims && !hasRefresh) {
      const signin = new URL('/signin', request.url);
      signin.searchParams.set('next', `${pathname}${search}`);
      return applySecurityHeaders(NextResponse.redirect(signin), csp);
    }

    // With only a refresh token the client renews the session on load; the
    // page's API calls stay protected either way.
    if (claims && claims.role !== 'OFFICIAL' && matches(pathname, OFFICIAL_PREFIXES)) {
      const denied = new URL('/map', request.url);
      denied.searchParams.set('denied', pathname);
      return applySecurityHeaders(NextResponse.redirect(denied), csp);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  // Next.js reads the nonce from this request header and applies it to the
  // framework's own inline scripts.
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applySecurityHeaders(response, csp);
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|icon|apple-touch-icon|android-chrome|manifest.json|sw.js|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
};
