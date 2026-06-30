import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sign } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { AUTH_COOKIE } from '@/lib/constants'

interface GoogleTokenPayload {
  sub: string       // Google user ID
  email: string
  email_verified: boolean
  name?: string
  picture?: string
  given_name?: string
}

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
  try {
    // Verify with Google's tokeninfo endpoint
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`)
    if (!res.ok) return null

    const payload = await res.json()

    // Verify audience matches our client ID
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId || payload.aud !== clientId) return null

    if (!payload.email_verified) return null

    return {
      sub: payload.sub,
      email: payload.email,
      email_verified: payload.email_verified === 'true' || payload.email_verified === true,
      name: payload.name,
      picture: payload.picture,
      given_name: payload.given_name,
    }
  } catch {
    return null
  }
}

function generateUsername(email: string, name?: string): string {
  // Try name first, then email prefix
  const base = (name || email.split('@')[0])
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)

  return base || 'user'
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'google-auth' })
  if (limited) return limited

  try {
    const { idToken, username: preferredUsername } = await request.json()

    if (!idToken) {
      return NextResponse.json({ error: 'Missing ID token' }, { status: 400 })
    }

    const googleUser = await verifyGoogleToken(idToken)
    if (!googleUser) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 })
    }

    // Check if user exists by googleId or email
    let user = await db.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.sub },
          { email: googleUser.email },
        ],
      },
      select: { id: true, email: true, username: true, name: true, avatar: true, bio: true, googleId: true, emailVerified: true, plan: true, tokenVersion: true },
    })

    if (user) {
      // Link Google account if not already linked
      if (!user.googleId) {
        await db.user.update({
          where: { id: user.id },
          data: { googleId: googleUser.sub, avatar: user.avatar || googleUser.picture },
        })
      }
    } else {
      // New user — create account
      let username = preferredUsername || generateUsername(googleUser.email, googleUser.name)

      // Ensure username is unique
      let suffix = 0
      let candidate = username
      while (await db.user.findUnique({ where: { username: candidate } })) {
        suffix++
        candidate = `${username}${suffix}`
      }
      username = candidate

      user = await db.user.create({
        data: {
          email: googleUser.email,
          username,
          name: googleUser.name || null,
          googleId: googleUser.sub,
          avatar: googleUser.picture || null,
          emailVerified: new Date(), // Google verifies the email
        },
        select: { id: true, email: true, username: true, name: true, avatar: true, bio: true, googleId: true, emailVerified: true, plan: true, tokenVersion: true },
      })
    }

    // Generate JWT
    const token = sign({ userId: user.id, tokenVersion: user.tokenVersion }, getJwtSecret(), { expiresIn: '7d' })

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        emailVerified: user.emailVerified,
        plan: user.plan,
      },
      isNewUser: !user.googleId || user.googleId === googleUser.sub,
    })

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })

    return response
  } catch (error) {
    console.error('Google auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
