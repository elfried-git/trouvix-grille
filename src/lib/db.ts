import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// En production : pas de logs verbeux. En dev : logs d'erreurs utiles.
function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Set DATABASE_URL to a valid Postgres connection string."
    );
  }
  if (!/^(postgres|postgresql):\/\//.test(url)) {
    throw new Error(
      "DATABASE_URL is invalid. It must start with postgres:// or postgresql://."
    );
  }
  return url;
}

function createPrismaClient() {
  return new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn'],
  });
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient();

// En dev, on réutilise l'instance pour éviter les hot-reload qui créent plein de connexions
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db