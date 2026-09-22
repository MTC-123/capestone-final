/**
 * Migration script for FireEventRecord schema overhaul.
 *
 * Run with: npx tsx apps/web/scripts/migrate-fire-records.ts
 *
 * Changes:
 * 1. Rename status values: VALIDATED -> VERIFIED, APPROVED -> LOCKED
 * 2. Map old lockedSections to new names:
 *    timeline + agencyArrivals + meansEngaged -> response
 *    economicLoss -> damage
 *    perimeter -> location
 * 3. Copy economicLoss data into damageDetail
 * 4. Copy meansEngaged data into responseDetail
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SECTION_MIGRATION: Record<string, string> = {
  timeline: 'response',
  agencyArrivals: 'response',
  meansEngaged: 'response',
  economicLoss: 'damage',
  perimeter: 'location',
};

async function migrate() {
  const records = await prisma.fireEventRecord.findMany();
  console.log(`Found ${records.length} records to migrate.`);

  let updated = 0;
  for (const record of records) {
    const data: Record<string, unknown> = {};
    let needsUpdate = false;

    // 1. Rename status values
    if ((record.recordStatus as string) === 'VALIDATED') {
      data.recordStatus = 'VERIFIED';
      needsUpdate = true;
    } else if ((record.recordStatus as string) === 'APPROVED') {
      data.recordStatus = 'LOCKED';
      needsUpdate = true;
    }

    // 2. Map old lockedSections to new names
    const oldSections = record.lockedSections;
    const newSectionsSet = new Set<string>();
    for (const s of oldSections) {
      const mapped = SECTION_MIGRATION[s];
      if (mapped) {
        newSectionsSet.add(mapped);
        needsUpdate = true;
      } else {
        newSectionsSet.add(s); // keep as-is if already new format
      }
    }
    if (needsUpdate || newSectionsSet.size !== oldSections.length) {
      data.lockedSections = Array.from(newSectionsSet);
      needsUpdate = true;
    }

    // 3. Copy economicLoss into damageDetail (if exists and damageDetail not set)
    const economicLoss = record.economicLoss as Record<string, unknown> | null;
    if (economicLoss && !record.damageDetail) {
      data.damageDetail = {
        forestAreaHa: economicLoss.forestAreaHa,
        infrastructureDamage: economicLoss.infrastructureDamage,
        agricultureDamage: economicLoss.agricultureDamage,
        otherDamage: economicLoss.otherDamage,
        totalEstimate: economicLoss.totalEstimate,
      };
      needsUpdate = true;
    }

    // 4. Copy meansEngaged into responseDetail (if exists and responseDetail not set)
    const meansEngaged = record.meansEngaged as Record<string, unknown> | null;
    if (meansEngaged && !record.responseDetail) {
      data.responseDetail = {
        vehicleCount: meansEngaged.vehicleCount,
        aircraftCount: meansEngaged.aircraftCount,
        personnelCount: meansEngaged.personnelCount,
        waterVolumeLiters: meansEngaged.waterVolumeLiters,
        retardantVolumeLiters: meansEngaged.retardantVolumeLiters,
      };
      needsUpdate = true;
    }

    if (needsUpdate) {
      await prisma.fireEventRecord.update({
        where: { id: record.id },
        data,
      });
      updated++;
      console.log(`  Migrated record ${record.id}`);
    }
  }

  console.log(`Migration complete. Updated ${updated}/${records.length} records.`);
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
