/**
 * A CDN caches any response marked `public` or `s-maxage` and replays it to
 * the next visitor without running the route, so a signed-in response would
 * reach anonymous users. Routes that read the caller's identity must only
 * ever allow the caller's own browser to cache.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_ROOT = join(__dirname, '../../../src/app/api');
const AUTH_CALL = /\b(getCurrentUser|requireRole|requireOfficial)\s*\(/;
const SHARED_CACHE = /Cache-Control['"]\s*[,:]\s*['"`][^'"`]*(public|s-maxage)/i;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

describe('cache policy of authenticated API routes', () => {
  const authenticated = routeFiles(API_ROOT).filter((file) => AUTH_CALL.test(readFileSync(file, 'utf8')));

  it('finds the authenticated routes', () => {
    expect(authenticated.length).toBeGreaterThan(20);
  });

  it.each(authenticated.map((file) => [relative(API_ROOT, file), file]))(
    '%s never allows shared (CDN) caching',
    (_name, file) => {
      expect(readFileSync(file, 'utf8')).not.toMatch(SHARED_CACHE);
    }
  );
});
