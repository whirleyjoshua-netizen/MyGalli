// Vercel populates this header at the edge for every request. Country-level
// only — we deliberately never read or store city or IP.
//
// Lives here rather than in route.ts because an App Router route file may only
// export route handlers and known config keys — any extra export fails
// `next build` with a generated-type constraint error that `tsc` cannot see.
export function countryFromHeaders(headers: Headers): string | null {
  const raw = headers.get('x-vercel-ip-country')
  if (!raw) return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}
