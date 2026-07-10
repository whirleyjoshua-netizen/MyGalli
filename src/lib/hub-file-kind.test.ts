import { describe, it, expect } from 'vitest'
import { fileKind } from './hub-file-kind'

describe('fileKind', () => {
  it('detects pdf by type', () => {
    expect(fileKind({ type: 'pdf', url: null })).toBe('pdf')
  })
  it('detects pdf by url extension (ignoring query/hash)', () => {
    expect(fileKind({ type: 'file', url: 'https://x.blob/report.pdf' })).toBe('pdf')
    expect(fileKind({ type: 'file', url: 'https://x.blob/report.pdf?token=abc#p=2' })).toBe('pdf')
  })
  it('detects image by type', () => {
    expect(fileKind({ type: 'image', url: null })).toBe('image')
  })
  it('detects image by each known extension', () => {
    for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp']) {
      expect(fileKind({ type: 'file', url: `https://x.blob/pic${ext}` })).toBe('image')
    }
  })
  it('is case-insensitive on the extension', () => {
    expect(fileKind({ type: 'file', url: 'https://x.blob/PIC.PNG' })).toBe('image')
    expect(fileKind({ type: 'file', url: 'https://x.blob/DOC.PDF' })).toBe('pdf')
  })
  it('returns other for links, audio, unknown, and empty', () => {
    expect(fileKind({ type: 'link', url: 'https://example.com' })).toBe('other')
    expect(fileKind({ type: 'file', url: 'https://x.blob/song.mp3' })).toBe('other')
    expect(fileKind({ type: 'file', url: null })).toBe('other')
    expect(fileKind({})).toBe('other')
  })
})
