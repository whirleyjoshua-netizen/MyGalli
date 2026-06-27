import { describe, it, expect } from 'vitest'
import { AUTH_COOKIE } from './constants'

describe('AUTH_COOKIE', () => {
  it('is the galli-auth cookie name', () => {
    expect(AUTH_COOKIE).toBe('galli-auth')
  })
})
