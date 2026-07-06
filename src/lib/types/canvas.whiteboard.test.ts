import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('whiteboard')", () => {
  it('returns artboard defaults', () => {
    const el = createElement('whiteboard')
    expect(el.type).toBe('whiteboard')
    expect(el.whiteboardWidth).toBe(800)
    expect(el.whiteboardHeight).toBe(450)
    expect(el.whiteboardBackground).toBe('blank')
    expect(el.whiteboardScene).toBe('')
    expect(el.whiteboardPreviewUrl).toBe('')
  })
})
