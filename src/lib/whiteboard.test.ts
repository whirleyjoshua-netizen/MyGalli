import { describe, it, expect } from 'vitest'
import { ARTBOARD_PRESETS, pushHistory, previewFilename, isBlankScene } from './whiteboard'

describe('ARTBOARD_PRESETS', () => {
  it('has 16:9, 4:3, 1:1 with correct dimensions', () => {
    expect(ARTBOARD_PRESETS).toEqual([
      { label: '16:9', width: 800, height: 450 },
      { label: '4:3', width: 800, height: 600 },
      { label: '1:1', width: 600, height: 600 },
    ])
  })
})

describe('pushHistory', () => {
  it('appends and caps to the last N, dropping oldest', () => {
    const start = ['a', 'b', 'c']
    expect(pushHistory(start, 'd', 3)).toEqual(['b', 'c', 'd'])
    expect(start).toEqual(['a', 'b', 'c']) // immutable
  })
  it('keeps all when under cap', () => {
    expect(pushHistory(['a'], 'b', 50)).toEqual(['a', 'b'])
  })
})

describe('previewFilename', () => {
  it('builds a stable name from the element id', () => {
    expect(previewFilename('el-123')).toBe('whiteboard-el-123.png')
  })
})

describe('isBlankScene', () => {
  it('is true for empty/whitespace/undefined', () => {
    expect(isBlankScene(undefined)).toBe(true)
    expect(isBlankScene('')).toBe(true)
    expect(isBlankScene('   ')).toBe(true)
  })
  it('is true for a scene with no objects', () => {
    expect(isBlankScene(JSON.stringify({ version: '6', objects: [] }))).toBe(true)
  })
  it('is false for a scene with objects', () => {
    expect(isBlankScene(JSON.stringify({ objects: [{ type: 'rect' }] }))).toBe(false)
  })
})
