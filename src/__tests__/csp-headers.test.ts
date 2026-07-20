import { describe, it, expect } from 'vitest'
const nextConfig = require('../../next.config.js')

async function csp(): Promise<string> {
  const headers = await nextConfig.headers()
  const value = headers[0].headers.find((h: { key: string }) => h.key === 'Content-Security-Policy')?.value
  expect(value).toBeTruthy()
  return value as string
}

function directive(policy: string, name: string): string {
  const found = policy.split('; ').find((d) => d.startsWith(`${name} `))
  expect(found, `missing ${name} directive`).toBeTruthy()
  return found as string
}

describe('Content-Security-Policy', () => {
  // The Kollab pool uploads client-direct via @vercel/blob's `upload()`, which
  // negotiates through https://vercel.com/api/blob and stores on
  // *.vercel-storage.com. Dropping either host silently breaks every upload in
  // the browser while server-side tests keep passing — they never make this call.
  it('allows the Blob client upload hosts in connect-src', async () => {
    const connect = directive(await csp(), 'connect-src')
    expect(connect).toContain('https://vercel.com')
    expect(connect).toContain('https://*.vercel-storage.com')
  })

  it('still allows blob assets to render', async () => {
    const policy = await csp()
    expect(directive(policy, 'img-src')).toContain('blob.vercel-storage.com')
    expect(directive(policy, 'media-src')).toContain('https:')
  })

  it('keeps the restrictive defaults', async () => {
    const policy = await csp()
    expect(policy).toContain("default-src 'self'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("base-uri 'self'")
    expect(policy).toContain("form-action 'self'")
  })
})
