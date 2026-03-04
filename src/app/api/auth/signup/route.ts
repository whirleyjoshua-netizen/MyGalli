import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hash } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import { getJwtSecret } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 3 signup attempts per minute per IP
  const limited = rateLimit(request, { limit: 3, windowMs: 60_000, prefix: 'signup' })
  if (limited) return limited

  try {
    const { email, username, password, name } = await request.json()

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username, and password are required' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Validate email format
    if (!email.includes('@') || !email.includes('.')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    // Validate username format
    if (!/^[a-z0-9_-]+$/i.test(username) || username.length < 3) {
      return NextResponse.json(
        { error: 'Username must be at least 3 characters and only contain letters, numbers, hyphens, and underscores' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await db.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email or username already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const hashedPassword = await hash(password, 12)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        username: username.toLowerCase(),
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
      },
    })

    // Generate token
    const token = sign(
      { userId: user.id },
      getJwtSecret(),
      { expiresIn: '7d' }
    )

    return NextResponse.json({ user, token }, { status: 201 })
  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
