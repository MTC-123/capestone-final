import fs from 'node:fs';
import path from 'node:path';
import { ERROR_CATALOG } from '../src/lib/errors/catalog';

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function toMarkdown() {
  const entries = Object.values(ERROR_CATALOG).sort((a, b) => a.code - b.code);
  const lines: string[] = [];
  lines.push('# Error Catalog');
  lines.push('');
  lines.push('This document is generated from the canonical catalog in src/lib/errors/catalog.ts.');
  lines.push('');
  for (const e of entries) {
    lines.push(`## ${e.code} — ${e.name}`);
    lines.push('');
    lines.push(`- Severity: ${e.severity}`);
    lines.push(`- HTTP status: ${e.httpStatus}`);
    lines.push(`- Developer message: ${e.developerMessage}`);
    lines.push(`- User message key: ${e.userMessageKey}`);
    lines.push('');
    lines.push('**Root causes**');
    for (const c of e.rootCauses) lines.push(`- ${c}`);
    lines.push('');
    lines.push('**Resolution steps**');
    for (const s of e.resolutionSteps) lines.push(`- ${s}`);
    if (e.remediationHints?.length) {
      lines.push('');
      lines.push('**Remediation hints**');
      for (const h of e.remediationHints) {
        const hint = h as { title: string; steps?: string[]; url?: string };
        lines.push(`- ${hint.title}`);
        const steps = hint.steps ?? [];
        for (const step of steps) lines.push(`  - ${step}`);
        if (hint.url) lines.push(`  - ${hint.url}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n');
}

function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const docsDir = path.join(repoRoot, 'docs', 'errors');
  const publicDir = path.join(repoRoot, 'public', 'errors');

  ensureDir(docsDir);
  ensureDir(publicDir);

  fs.writeFileSync(path.join(docsDir, 'catalog.md'), toMarkdown(), 'utf8');
  fs.writeFileSync(path.join(publicDir, 'catalog.json'), JSON.stringify(ERROR_CATALOG, null, 2), 'utf8');
}

main();

