import 'server-only'

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  lifePilotPrisma?: PrismaClient
}

export function getPrisma(): PrismaClient {
  if (globalForPrisma.lifePilotPrisma) return globalForPrisma.lifePilotPrisma

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('Authentication database is not configured.')

  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })
  globalForPrisma.lifePilotPrisma = prisma
  return prisma
}
