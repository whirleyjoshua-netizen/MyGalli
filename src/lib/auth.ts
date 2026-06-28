import { NextRequest } from 'next/server'
import { verify } from 'jsonwebtoken'
import { db } from './db'
import { AUTH_COOKIE } from './constants'

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret === 'your-super-secret-jwt-key-change-this-in-production') {
    throw new Error('JWT_SECRET environment variable must be set to a strong, unique value')
  }
  return secret
}

// Verify auth token directly (for use with manual token extraction)
export async function verifyAuth(token: string) {
  try {
    const decoded = verify(
      token,
      getJwtSecret()
    ) as { userId: string }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        emailVerified: true,
      },
    })

    return user
  } catch {
    return null
  }
}

// Verify auth from NextRequest (extracts token from httpOnly cookie)
export async function getUser(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value

  if (!token) {
    return null
  }

  try {
    const decoded = verify(
      token,
      getJwtSecret()
    ) as { userId: string }

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        emailVerified: true,
      },
    })

    return user
  } catch {
    return null
  }
}
