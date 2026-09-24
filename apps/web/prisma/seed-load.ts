/**
 * Load-test data generator for k6 runs against the RICER Ifrane API.
 *
 * Generates SEED_LOAD_COUNT (default 1000) synthetic reports and roughly a
 * tenth as many synthetic incidents, scattered inside the Ifrane Province
 * bounding box. Every generated record's `description` is prefixed with
 * "[LOAD]" so this script — and only this script — can find and delete its
 * own output on the next run (`npx tsx prisma/seed-load.ts`), without ever
 * touching the demo dataset created by `prisma/seed.ts`.
 *
 * Usage:
 *   npx tsx prisma/seed-load.ts
 *   SEED_LOAD_COUNT=5000 npx tsx prisma/seed-load.ts
 *
 * Note: `prisma/seed.ts` (the demo seed) wipes the *entire* Incident and
 * Report collections on every run, which takes [LOAD] rows with it. Run
 * this script after `prisma:seed`, not before, if you need both datasets
 * present at once.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createRng, referenceNumber } from './seed-data/rng';
import { PROVINCE_BBOX, point } from './seed-data/geo';
import { FIRE_CAUSE_KEYS } from '../src/config/constants';

const prisma = new PrismaClient();

const LOAD_TAG = '[LOAD]';
const BATCH_SIZE = 500;
const LOAD_USERS = 5;

async function chunkedCreateMany<T>(label: string, data: T[], create: (batch: T[]) => Promise<unknown>) {
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    await create(batch);
    process.stdout.write(`\r  ${label}: ${Math.min(i + BATCH_SIZE, data.length)}/${data.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  const reportCount = Math.max(1, parseInt(process.env.SEED_LOAD_COUNT || '1000', 10));
  const incidentCount = Math.max(20, Math.round(reportCount / 10));
  const seed = 900_000_000 + reportCount;
  const r = createRng(seed);

  console.log(`Load seed: ${incidentCount} incidents, ${reportCount} reports (SEED_LOAD_COUNT=${reportCount})`);

  // ── Idempotent cleanup: only ever touch data this script tagged ───────
  // NB: Prisma's Mongo connector builds `startsWith`/`contains` into a raw
  // regex without escaping metacharacters, so a literal "[LOAD]" filter
  // would be parsed as the character class /^[LOAD]/ and silently match
  // nothing. "LOAD" has no regex metacharacters, so `contains: 'LOAD'`
  // reliably finds every row whose description carries our tag.
  console.log('Deleting previous [LOAD] data...');
  const delReports = await prisma.report.deleteMany({ where: { description: { contains: 'LOAD' } } });
  const delIncidents = await prisma.incident.deleteMany({ where: { description: { contains: 'LOAD' } } });
  console.log(`  removed ${delReports.count} reports, ${delIncidents.count} incidents`);

  // ── Ensure the dedicated load-test civilian pool exists (upsert, so a
  // prior `prisma:seed` run wiping the User collection can't orphan us). ──
  const loadUserIds: string[] = [];
  const dummyHash = await bcrypt.hash('load-test-not-a-real-password', 4); // low cost: never used to authenticate
  for (let i = 1; i <= LOAD_USERS; i++) {
    const cin = `LOAD${String(i).padStart(5, '0')}`;
    const user = await prisma.user.upsert({
      where: { cin },
      update: {},
      create: {
        cin,
        phone: `+212600${String(i).padStart(6, '0')}`,
        password: dummyHash,
        role: 'CIVILIAN',
        fullName: `Load Test User ${i}`,
      },
    });
    loadUserIds.push(user.id);
  }

  // ── Incidents ───────────────────────────────────────────────────────
  const incidentIds = Array.from({ length: incidentCount }, () => r.objectId());
  const incidentRows: Prisma.IncidentCreateManyInput[] = incidentIds.map((id, i) => {
    const lat = r.float(PROVINCE_BBOX.minLat, PROVINCE_BBOX.maxLat, 5);
    const lng = r.float(PROVINCE_BBOX.minLng, PROVINCE_BBOX.maxLng, 5);
    const createdAt = new Date(Date.UTC(2026, r.int(5, 8), r.int(1, 28), r.int(0, 23), r.int(0, 59)));
    return {
      id,
      location: point(lat, lng),
      cause: r.pick(FIRE_CAUSE_KEYS as readonly string[]),
      severity: r.int(1, 5),
      status: r.pick(['VIGILANCE', 'ALERTE', 'INTERVENTION', 'MAITRISE', 'ETEINT'] as const),
      description: `${LOAD_TAG} synthetic incident #${i + 1} for k6 load testing`,
      createdAt,
      updatedAt: createdAt,
    };
  });
  await chunkedCreateMany('incidents', incidentRows, (batch) => prisma.incident.createMany({ data: batch }));

  // ── Reports ─────────────────────────────────────────────────────────
  let refSeq = 1;
  const reportRows: Prisma.ReportCreateManyInput[] = Array.from({ length: reportCount }, (_, i) => {
    const lat = r.float(PROVINCE_BBOX.minLat, PROVINCE_BBOX.maxLat, 5);
    const lng = r.float(PROVINCE_BBOX.minLng, PROVINCE_BBOX.maxLng, 5);
    const createdAt = new Date(Date.UTC(2026, r.int(5, 8), r.int(1, 28), r.int(0, 23), r.int(0, 59)));
    const linkToIncident = r.bool(0.3);
    return {
      id: r.objectId(),
      userId: r.pick(loadUserIds),
      latitude: lat,
      longitude: lng,
      description: `${LOAD_TAG} synthetic report #${i + 1} for k6 load testing`,
      images: [],
      status: r.pick(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const),
      cause: r.pick(FIRE_CAUSE_KEYS as readonly string[]),
      incidentId: linkToIncident ? r.pick(incidentIds) : undefined,
      anonymous: r.bool(0.2),
      referenceNumber: referenceNumber(createdAt, refSeq++),
      clientSubmissionId: r.uuid(),
      createdAt,
      updatedAt: createdAt,
    };
  });
  await chunkedCreateMany('reports', reportRows, (batch) => prisma.report.createMany({ data: batch }));

  console.log('\nLoad seed complete.');
  console.log(`  Incidents: ${incidentRows.length}`);
  console.log(`  Reports:   ${reportRows.length}`);
  console.log(`  Load users: ${loadUserIds.length} (cin LOAD00001..LOAD${String(LOAD_USERS).padStart(5, '0')})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
