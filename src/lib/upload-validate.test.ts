// src/lib/upload-validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateUpload, extensionForMime } from './upload-validate'

describe('validateUpload', () => {
  it('accepts an image up to 10MB', () => {
    expect(validateUpload('image/png', 9 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects an image over 10MB', () => {
    const r = validateUpload('image/png', 11 * 1024 * 1024)
    expect(r.ok).toBe(false)
  })
  it('accepts an audio file up to 25MB', () => {
    expect(validateUpload('audio/mpeg', 20 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects an audio file over 25MB', () => {
    expect(validateUpload('audio/mpeg', 26 * 1024 * 1024).ok).toBe(false)
  })
  it('rejects a disallowed type', () => {
    expect(validateUpload('application/pdf', 100).ok).toBe(false)
  })
})

describe('extensionForMime', () => {
  it('maps audio + image mimes', () => {
    expect(extensionForMime('audio/mpeg')).toBe('.mp3')
    expect(extensionForMime('image/png')).toBe('.png')
    expect(extensionForMime('application/unknown')).toBe('')
  })
})
