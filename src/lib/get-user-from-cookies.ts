import { cookies } from 'next/headers'
import { verify } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { AUTH_COOKIE } from '@/lib/constants'

export async function getUserFromCookies(): Promise<{ id: string } | null> {
  try {
    const token = (await cookies()).get(AUTH_COOKIE)?.value
    if (!token) return null
    const decoded = verify(token, getJwtSecret()) as { userId?: string }
    return decoded.userId ? { id: decoded.userId } : null
  } catch {
    return null
  }
}
