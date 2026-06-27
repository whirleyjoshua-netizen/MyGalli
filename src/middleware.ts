import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE } from '@/lib/constants'

const PROTECTED_PATHS = [
  '/dashboard',
  '/analytics',
  '/responses',
  '/card-studio',
  '/new-kit',
  '/editor',
  '/create',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path))

  if (!isProtected) return NextResponse.next()

  const token = request.cookies.get(AUTH_COOKIE)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/analytics/:path*',
    '/responses/:path*',
    '/card-studio/:path*',
    '/new-kit/:path*',
    '/editor/:path*',
    '/create/:path*',
  ],
}
