// Extracted from route.ts: a Next.js App Router route file may only export
// route handlers and a small set of known config keys. Any other export fails
// the build's generated type check ("not assignable to type 'never'").

// Vercel populates this header at the edge for every request. Country-level
// only — we deliberately never read or store city or IP.
export function countryFromHeaders(headers: Headers): string | null {
  const raw = headers.get('x-vercel-ip-country')
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}
