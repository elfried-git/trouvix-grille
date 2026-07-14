import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// En production : pas de logs verbeux. En dev : logs d'erreurs utiles.
function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn'],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

// En dev, on réutilise l'instance pour éviter les hot-reload qui créent plein de connexions
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db