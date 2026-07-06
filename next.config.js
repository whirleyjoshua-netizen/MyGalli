/** @type {import('next').NextConfig} */

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://images.unsplash.com https://ui-avatars.com https://lh3.googleusercontent.com https://www.gstatic.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://apis.google.com https://oauth2.googleapis.com https://nominatim.openstreetmap.org",
  "frame-src 'self' https://accounts.google.com https://open.spotify.com https://w.soundcloud.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  // Pin the tracing root to this project — a stray lockfile in a parent dir
  // otherwise makes Next infer the wrong workspace root (breaks file tracing on deploy).
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
