// Prisma Client - Database Connection with Pooling and Graceful Shutdown
// Supports both SQLite (local dev) and PostgreSQL with Prisma Data Proxy/Accelerate (production)

import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  databaseUrl: string | undefined
}

// Store the initial DATABASE_URL when module loads
const currentDatabaseUrl = process.env.DATABASE_URL

// Detect database type
const isPostgres = currentDatabaseUrl?.startsWith('postgresql://') || currentDatabaseUrl?.startsWith('postgres://')
const isAccelerate = currentDatabaseUrl?.startsWith('prisma://')
const isDataProxy = currentDatabaseUrl?.startsWith('prisma+postgres://')
const isSQLite = currentDatabaseUrl?.startsWith('file:')

// In development, reset client if DATABASE_URL changed
if (process.env.NODE_ENV !== 'production') {
  if (globalForPrisma.databaseUrl && globalForPrisma.databaseUrl !== currentDatabaseUrl) {
    console.log('[DB] DATABASE_URL changed, resetting Prisma client...')
    if (globalForPrisma.prisma) {
      globalForPrisma.prisma.$disconnect().catch(() => {})
    }
    globalForPrisma.prisma = undefined
  }
}

interface ConnectionMetrics {
  totalQueries: number
  activeConnections: number
  queryErrors: number
  lastErrorTime: number
}

const metrics: ConnectionMetrics = {
  totalQueries: 0,
  activeConnections: 0,
  queryErrors: 0,
  lastErrorTime: 0
}

/**
 * Get or create Prisma client with optimized configuration
 * Supports SQLite (local) and PostgreSQL with Accelerate (production)
 */
export const db = (() => {
  // Force reload Prisma Client by clearing the cache
  if (process.env.FORCE_PRISMA_RELOAD === 'true' && globalForPrisma.prisma) {
    console.log('[DB] Force reloading Prisma client...')
    globalForPrisma.prisma = undefined
  }

  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma
  }

  // Log database type for debugging
  if (isAccelerate) {
    console.log('[DB] 🔥 Connecting to PostgreSQL via Prisma Accelerate (Production)')
  } else if (isDataProxy) {
    console.log('[DB] ⚡ Connecting via Prisma Data Proxy with Accelerate extension (Production)')
  } else if (isPostgres) {
    console.log('[DB] 🐘 Connecting to PostgreSQL directly')
  } else if (isSQLite) {
    console.log('[DB] 📁 Using SQLite database (Local Development)')
  } else {
    console.log('[DB] ⚠️  Unknown database type:', process.env.DATABASE_URL?.substring(0, 30) + '...')
  }

  // Create new client with optimized settings
  const prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // Extend with Accelerate ONLY when using Data Proxy format (prisma+postgres://)
  // Note: prisma:// URLs already have Accelerate built-in, no extension needed
  const extendedClient = isDataProxy
    ? prismaClient.$extends(withAccelerate())
    : prismaClient

  // Store the DATABASE_URL used for this client
  globalForPrisma.databaseUrl = process.env.DATABASE_URL
  globalForPrisma.prisma = extendedClient

  console.log('[DB] ✅ Prisma client initialized successfully')
  return extendedClient
})()

/**
 * Log query metrics
 */
export function logQuery(type: 'query' | 'error' | 'warn', details?: string) {
  if (type === 'error') {
    metrics.queryErrors++
    metrics.lastErrorTime = Date.now()

    if (Date.now() - metrics.lastErrorTime < 60000) {
      console.error('[DATABASE ERROR] Recent errors in last 60s:')
      console.error(`Last error: ${details || 'Unknown error'}`)
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`[DATABASE ${type.toUpperCase()}]`, details || '')
  }
}

/**
 * Graceful database shutdown
 */
export async function shutdownDatabase() {
  try {
    if (globalForPrisma.prisma) {
      await globalForPrisma.prisma.$disconnect()
      console.log('[DATABASE] Disconnected from database')
      globalForPrisma.prisma = undefined
    }
  } catch (error) {
    console.error('[DATABASE] Shutdown error:', error)
    throw error
  }
}

/**
 * Get connection metrics
 */
export function getDatabaseMetrics(): ConnectionMetrics {
  return { ...metrics }
}

/**
 * Check database connection health
 */
export async function checkHealth() {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch (error) {
    console.error('[DATABASE] Health check failed:', error)
    return false
  }
}
