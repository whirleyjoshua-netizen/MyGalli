import { describe, it, expect } from 'vitest'
import { normalizeEmail, sniffFormContact } from './email'

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Josh@X.com ')).toBe('josh@x.com')
  })

  it('treats case and whitespace variants as one value', () => {
    expect(normalizeEmail('Josh@X.com ')).toBe(normalizeEmail('josh@x.com'))
  })

  it('rejects values that are not emails', () => {
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('')).toBeNull()
    expect(normalizeEmail('   ')).toBeNull()
  })

  it('rejects non-strings', () => {
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeEmail(undefined)).toBeNull()
    expect(normalizeEmail(42)).toBeNull()
    expect(normalizeEmail({ email: 'a@b.com' })).toBeNull()
  })
})

describe('sniffFormContact', () => {
  it('finds an email by field type', () => {
    const r = { e1: { type: 'email', question: 'Contact', answer: 'A@B.com' } }
    expect(sniffFormContact(r).email).toBe('a@b.com')
  })

  it('finds an email by question text when the type is generic', () => {
    const r = { e1: { type: 'short-answer', question: 'Your e-mail address', answer: 'x@y.com' } }
    expect(sniffFormContact(r).email).toBe('x@y.com')
  })

  it('falls back to any answer that looks like an email', () => {
    const r = { e1: { type: 'short-answer', question: 'How can we reach you?', answer: 'z@q.com' } }
    expect(sniffFormContact(r).email).toBe('z@q.com')
  })

  it('prefers a typed email field over a coincidental one', () => {
    const r = {
      e1: { type: 'short-answer', question: 'Referred by', answer: 'friend@old.com' },
      e2: { type: 'email', question: 'Your email', answer: 'real@new.com' },
    }
    expect(sniffFormContact(r).email).toBe('real@new.com')
  })

  it('finds a name by question text', () => {
    const r = {
      e1: { type: 'short-answer', question: 'Your name', answer: 'Ada Lovelace' },
      e2: { type: 'email', question: 'Email', answer: 'ada@x.com' },
    }
    expect(sniffFormContact(r)).toEqual({ email: 'ada@x.com', name: 'Ada Lovelace' })
  })

  it('returns nulls when there is no email', () => {
    const r = { e1: { type: 'short-answer', question: 'Feedback', answer: 'Great page' } }
    expect(sniffFormContact(r)).toEqual({ email: null, name: null })
  })

  it('survives malformed input', () => {
    expect(sniffFormContact(null)).toEqual({ email: null, name: null })
    expect(sniffFormContact('nope')).toEqual({ email: null, name: null })
    expect(sniffFormContact({ e1: null })).toEqual({ email: null, name: null })
    expect(sniffFormContact({ e1: { answer: ['a@b.com'] } })).toEqual({ email: null, name: null })
  })
})
