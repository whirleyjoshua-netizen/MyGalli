import { describe, it, expect } from 'vitest'
import { validateUpload, extensionForMime, VIDEO_TYPES, MAX_VIDEO } from './upload-validate'

describe('validateUpload video', () => {
  it('accepts mp4 under the cap', () => {
    expect(validateUpload('video/mp4', 50 * 1024 * 1024)).toEqual({ ok: true })
  })
  it('rejects video over 100MB', () => {
    const r = validateUpload('video/mp4', 101 * 1024 * 1024)
    expect(r.ok).toBe(false)
  })
  it('exposes VIDEO_TYPES and a 100MB cap', () => {
    expect(VIDEO_TYPES).toContain('video/mp4')
    expect(MAX_VIDEO).toBe(100 * 1024 * 1024)
  })
  it('maps mp4/webm/mov extensions', () => {
    expect(extensionForMime('video/mp4')).toBe('.mp4')
    expect(extensionForMime('video/webm')).toBe('.webm')
    expect(extensionForMime('video/quicktime')).toBe('.mov')
  })
})
