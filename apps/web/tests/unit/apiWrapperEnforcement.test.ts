import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function listRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listRouteFiles(full));
    else if (entry.isFile() && entry.name === 'route.ts') out.push(full);
  }
  return out;
}

describe('API wrapper enforcement', () => {
  it('ensures all API routes use withApiHandler', () => {
    const apiDir = path.resolve(__dirname, '../../src/app/api');
    const files = listRouteFiles(apiDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes('withApiHandler')) offenders.push(file);
      if (content.match(/export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE)/)) offenders.push(file);
    }

    expect(offenders).toEqual([]);
  });
});

