import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HubPostComposer } from './HubPostComposer'

beforeEach(() => {
  vi.restoreAllMocks()
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

describe('HubPostComposer pollNonce', () => {
  it('does not open a block by default', () => {
    render(<HubPostComposer hubId="h1" onPosted={() => {}} />)
    expect(screen.getByTitle('Poll')).toBeInTheDocument() // picker still collapsed
  })

  it('opens a poll block when the nonce increments', () => {
    const { rerender } = render(<HubPostComposer hubId="h1" onPosted={() => {}} pollNonce={0} />)
    rerender(<HubPostComposer hubId="h1" onPosted={() => {}} pollNonce={1} />)
    // With a block open the picker row is replaced by the BlockEditor.
    expect(screen.queryByTitle('Poll')).toBeNull()
  })
})
