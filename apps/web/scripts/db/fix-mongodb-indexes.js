// This script creates sparse unique indexes for the Report-Incident relationship
// Run with: node scripts/fix-mongodb-indexes.js

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');

async function fixIndexes() {
  const prisma = new PrismaClient();

  try {
    console.log('Connected to MongoDB via Prisma');

    // Create sparse unique index on Report.incidentId
    console.log('Creating sparse unique index on Report.incidentId...');
    await prisma.$runCommandRaw({
      createIndexes: 'Report',
      indexes: [{
        key: { incidentId: 1 },
        name: 'Report_incidentId_sparse_unique',
        unique: true,
        sparse: true
      }]
    });
    console.log('✓ Created sparse unique index on Report.incidentId');

    // Create sparse unique index on Incident.reportId
    console.log('Creating sparse unique index on Incident.reportId...');
    await prisma.$runCommandRaw({
      createIndexes: 'Incident',
      indexes: [{
        key: { reportId: 1 },
        name: 'Incident_reportId_sparse_unique',
        unique: true,
        sparse: true
      }]
    });
    console.log('✓ Created sparse unique index on Incident.reportId');

    console.log('\n✅ Sparse unique indexes created successfully!');
    console.log('   - Report.incidentId: ensures each incident can only be linked to one report');
    console.log('   - Incident.reportId: ensures each report can only create one incident');
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('✓ Indexes already exist');
    } else {
      console.error('❌ Error creating indexes:', error);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

fixIndexes();
