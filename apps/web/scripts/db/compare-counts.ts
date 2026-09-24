/**
 * Prints per-collection (per Prisma model) document counts for two Mongo
 * URIs side by side, and flags any mismatch. This is the verification step
 * for a backup/restore rehearsal — see docs/runbooks/backup-restore.md.
 *
 * Usage:
 *   npx tsx scripts/db/compare-counts.ts <uriA> <uriB>
 *
 * Example (compare local dev DB to a freshly-restored one):
 *   npx tsx scripts/db/compare-counts.ts \
 *     "mongodb://localhost:27017/ricer?replicaSet=rs0&directConnection=true" \
 *     "mongodb://localhost:27017/ricer_restore_test?replicaSet=rs0&directConnection=true"
 */
import { PrismaClient, Prisma } from '@prisma/client';

function redact(uri: string): string {
  return uri.replace(/(mongodb(\+srv)?:\/\/)[^:@]+:[^@]+@/, '$1***:***@');
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

const MODEL_NAMES: string[] = Prisma.dmmf.datamodel.models.map((m) => m.name);

async function countsFor(uri: string): Promise<Record<string, number | string>> {
  const client = new PrismaClient({ datasources: { db: { url: uri } } });
  const out: Record<string, number | string> = {};
  for (const model of MODEL_NAMES) {
    const key = lowerFirst(model);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = (client as any)[key];
      out[model] = await delegate.count();
    } catch (e) {
      out[model] = `err:${(e as Error).message.split('\n')[0].slice(0, 40)}`;
    }
  }
  await client.$disconnect();
  return out;
}

async function main() {
  const [, , uriA, uriB] = process.argv;
  if (!uriA || !uriB) {
    console.error('usage: npx tsx scripts/db/compare-counts.ts <uriA> <uriB>');
    process.exit(1);
  }

  console.log(`A: ${redact(uriA)}`);
  console.log(`B: ${redact(uriB)}\n`);

  const [a, b] = await Promise.all([countsFor(uriA), countsFor(uriB)]);

  const nameWidth = Math.max(...MODEL_NAMES.map((m) => m.length)) + 2;
  let mismatches = 0;
  console.log(`${'Model'.padEnd(nameWidth)}${'A'.padStart(8)}${'B'.padStart(8)}  Match`);
  for (const model of MODEL_NAMES) {
    const av = a[model];
    const bv = b[model];
    const match = av === bv;
    if (!match) mismatches++;
    console.log(`${model.padEnd(nameWidth)}${String(av).padStart(8)}${String(bv).padStart(8)}  ${match ? 'OK' : 'MISMATCH'}`);
  }

  console.log(`\n${mismatches === 0 ? 'All collections match.' : `${mismatches} collection(s) differ.`}`);
  process.exit(mismatches === 0 ? 0 : 2);
}

main();
