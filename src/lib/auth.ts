import { NextRequest } from 'next/server'
import { verify } from 'jsonwebtoken'
import { db } from './db'

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
      },
    })

    return user
  } catch {
    return null
  }
}

// Verify auth from NextRequest (extracts token from Authorization header)
export async function getUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

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
      },
    })

    return user
  } catch {
    return null
  }
}
