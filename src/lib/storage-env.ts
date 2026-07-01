/**
 * Resolve storage / rate-limit credentials from the environment, accepting both
 * the app's canonical variable names AND the names Vercel's Marketplace
 * integrations inject.
 *
 * Why this exists: the Vercel KV/Redis and Blob integrations create their own
 * env vars (`KV_REST_API_*`, and a prefixed `*_READ_WRITE_TOKEN` such as
 * `BLOB1_READ_WRITE_TOKEN` when a name collision occurs). Those vars are marked
 * Sensitive, so their values can't be read back to re-create them under the
 * canonical names — the code must accept the names Vercel provides.
 */

/** Upstash/Vercel-KV REST URL (both point at the same Upstash REST endpoint). */
export function redisRestUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
}

/** Upstash/Vercel-KV REST token. */
export function redisRestToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
}

/**
 * Vercel Blob read-write token. Prefer the canonical `BLOB_READ_WRITE_TOKEN`;
 * otherwise match any `*_READ_WRITE_TOKEN` whose value is a Blob RW token
 * (Vercel prefixes the var — e.g. `BLOB1_READ_WRITE_TOKEN` — on name collision).
 */
export function blobReadWriteToken(): string | undefined {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN
  for (const [key, value] of Object.entries(process.env)) {
    if (key.endsWith('READ_WRITE_TOKEN') && value?.startsWith('vercel_blob_rw_')) {
      return value
    }
  }
  return undefined
}
