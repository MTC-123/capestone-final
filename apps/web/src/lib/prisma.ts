import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Validate DATABASE_URL exists
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error']
      : ['error', 'warn'],
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Eagerly warm up the connection pool so the first query doesn't pay the
// cold-start cost (MongoDB Atlas free/serverless tiers can take 2-5 s).
void prisma.$connect().catch(() => {
  // Non-blocking — if this fails the first query will retry automatically.
});

// Health check utility
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    // For MongoDB, we can't use $queryRaw. Use $connect instead.
    await prisma.$connect();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
