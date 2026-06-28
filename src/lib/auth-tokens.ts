import { randomBytes } from 'crypto'
import { db } from './db'

export type TokenType = 'verify' | 'reset'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenTtlMs(type: TokenType): number {
  return type === 'verify' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export async function createToken(userId: string, type: TokenType): Promise<string> {
  const token = generateToken()
  await db.verificationToken.create({
    data: { token, userId, type, expiresAt: new Date(Date.now() + tokenTtlMs(type)) },
  })
  return token
}

// Returns the userId if valid (correct type, not expired); always single-use.
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  const row = await db.verificationToken.findUnique({ where: { token } })
  if (!row || row.type !== type) return null
  await db.verificationToken.delete({ where: { token } }).catch(() => {})
  if (isExpired(row.expiresAt)) return null
  return row.userId
}
