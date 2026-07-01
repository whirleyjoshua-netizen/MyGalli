import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { redisRestUrl, redisRestToken, blobReadWriteToken } from '@/lib/storage-env'

// Save/restore the env vars these tests touch so they don't leak.
const KEYS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
  'BLOB_READ_WRITE_TOKEN',
  'BLOB1_READ_WRITE_TOKEN',
]
const saved: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k]
    delete process.env[k]
  }
})
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('redis env resolution', () => {
  it('prefers the canonical UPSTASH_* names', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://up.example'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'up-token'
    process.env.KV_REST_API_URL = 'https://kv.example'
    process.env.KV_REST_API_TOKEN = 'kv-token'
    expect(redisRestUrl()).toBe('https://up.example')
    expect(redisRestToken()).toBe('up-token')
  })

  it('falls back to Vercel KV integration names', () => {
    process.env.KV_REST_API_URL = 'https://kv.example'
    process.env.KV_REST_API_TOKEN = 'kv-token'
    expect(redisRestUrl()).toBe('https://kv.example')
    expect(redisRestToken()).toBe('kv-token')
  })

  it('returns undefined when nothing is set', () => {
    expect(redisRestUrl()).toBeUndefined()
    expect(redisRestToken()).toBeUndefined()
  })
})

describe('blob token resolution', () => {
  it('prefers the canonical BLOB_READ_WRITE_TOKEN', () => {
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_rw_canonical'
    process.env.BLOB1_READ_WRITE_TOKEN = 'vercel_blob_rw_prefixed'
    expect(blobReadWriteToken()).toBe('vercel_blob_rw_canonical')
  })

  it('matches a prefixed *_READ_WRITE_TOKEN by its Blob token value', () => {
    process.env.BLOB1_READ_WRITE_TOKEN = 'vercel_blob_rw_prefixed'
    expect(blobReadWriteToken()).toBe('vercel_blob_rw_prefixed')
  })

  it('ignores a *_READ_WRITE_TOKEN whose value is not a Blob token', () => {
    process.env.BLOB1_READ_WRITE_TOKEN = 'not-a-blob-token'
    expect(blobReadWriteToken()).toBeUndefined()
  })

  it('returns undefined when no blob token is present', () => {
    expect(blobReadWriteToken()).toBeUndefined()
  })
})
