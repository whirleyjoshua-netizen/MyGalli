import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// --- Redis-backed rate limiter (production) ---
let redisLimiters: Map<string, Ratelimit> | null = null

function getRedisLimiter(prefix: string, limit: number, windowMs: number): Ratelimit | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  if (!redisLimiters) redisLimiters = new Map()

  const key = `${prefix}:${limit}:${windowMs}`
  if (!redisLimiters.has(key)) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    redisLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
        prefix: `rl:${prefix}`,
      })
    )
  }

  return redisLimiters.get(key)!
}

// --- In-memory fallback (dev / missing Redis config) ---
interface RateLimitEntry {
  count: number
  resetAt: number
}

const memStore = new Map<string, RateLimitEntry>()

// Clean up expired entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  const cleanup = () => {
    const now = Date.now()
    for (const [key, entry] of memStore) {
      if (now > entry.resetAt) memStore.delete(key)
    }
  }
  // Only set interval in Node runtime (not edge)
  try { setInterval(cleanup, 5 * 60 * 1000) } catch { /* edge runtime */ }
}

function memoryRateLimit(ip: string, prefix: string, limit: number, windowMs: number): NextResponse | null {
  const key = `${prefix}:${ip}`
  const now = Date.now()
  const entry = memStore.get(key)

  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }

  entry.count++

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  return null
}

/**
 * Rate limiter that uses Upstash Redis in production and falls back to in-memory for dev.
 * Returns null if allowed, or a NextResponse (429) if rate limited.
 */
export async function rateLimit(
  request: NextRequest,
  opts: { limit: number; windowMs: number; prefix?: string }
): Promise<NextResponse | null> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const prefix = opts.prefix || 'global'

  // Try Redis first
  const redisLimiter = getRedisLimiter(prefix, opts.limit, opts.windowMs)
  if (redisLimiter) {
    const { success, reset } = await redisLimiter.limit(ip)
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.max(retryAfter, 1)) } }
      )
    }
    return null
  }

  // Fallback to in-memory
  return memoryRateLimit(ip, prefix, opts.limit, opts.windowMs)
}
