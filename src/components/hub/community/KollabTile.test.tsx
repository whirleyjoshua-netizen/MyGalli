import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KollabTile } from './KollabTile'

const base = {
  count: 24, pendingCount: 0, canDrop: true, isPrivileged: false,
  uploading: false, onDrop: () => {}, onSee: () => {},
}

describe('KollabTile', () => {
  it('shows the approved count', () => {
    render(<KollabTile {...base} />)
    expect(screen.getByText('24 clips & photos')).toBeInTheDocument()
  })

  it('hides Drop content when the viewer cannot drop', () => {
    render(<KollabTile {...base} canDrop={false} />)
    expect(screen.queryByRole('button', { name: /drop content/i })).not.toBeInTheDocument()
  })

  it('disables See content when the pool is empty and there is no pending backlog', () => {
    render(<KollabTile {...base} count={0} />)
    expect(screen.getByRole('button', { name: /see content/i })).toBeDisabled()
  })

  it('enables See content for a moderator when approved is 0 but pending is 3', () => {
    render(<KollabTile {...base} count={0} pendingCount={3} isPrivileged />)
    expect(screen.getByRole('button', { name: /see content/i })).not.toBeDisabled()
  })

  it('keeps See content disabled for a non-privileged viewer when approved is 0, whatever pending says', () => {
    render(<KollabTile {...base} count={0} pendingCount={3} isPrivileged={false} />)
    expect(screen.getByRole('button', { name: /see content/i })).toBeDisabled()
  })

  it('renders the zero-state copy', () => {
    render(<KollabTile {...base} count={0} />)
    expect(screen.getByText('Be the first to drop something.')).toBeInTheDocument()
  })

  it('renders singular copy at count 1', () => {
    render(<KollabTile {...base} count={1} />)
    expect(screen.getByText('1 clip or photo')).toBeInTheDocument()
  })

  it('renders plural copy at count 2', () => {
    render(<KollabTile {...base} count={2} />)
    expect(screen.getByText('2 clips & photos')).toBeInTheDocument()
  })

  it('shows the awaiting-review badge only to moderators', () => {
    const { rerender } = render(<KollabTile {...base} pendingCount={3} isPrivileged={false} />)
    expect(screen.queryByText(/awaiting review/i)).not.toBeInTheDocument()
    rerender(<KollabTile {...base} pendingCount={3} isPrivileged />)
    expect(screen.getByText('3 awaiting review')).toBeInTheDocument()
  })

  it('calls onSee when See content is clicked', () => {
    const onSee = vi.fn()
    render(<KollabTile {...base} onSee={onSee} />)
    fireEvent.click(screen.getByRole('button', { name: /see content/i }))
    expect(onSee).toHaveBeenCalledOnce()
  })
})

describe('Make a reel', () => {
  it('is hidden when canStitch is false', () => {
    render(<KollabTile count={10} pendingCount={0} canDrop canStitch={false} isPrivileged={false} uploading={false} onDrop={() => {}} onSee={() => {}} onMakeReel={() => {}} />)
    expect(screen.queryByRole('button', { name: /make a reel/i })).toBeNull()
  })

  it('is shown and calls onMakeReel when canStitch is true', () => {
    const onMakeReel = vi.fn()
    render(<KollabTile count={10} pendingCount={0} canDrop canStitch isPrivileged={false} uploading={false} onDrop={() => {}} onSee={() => {}} onMakeReel={onMakeReel} />)
    fireEvent.click(screen.getByRole('button', { name: /make a reel/i }))
    expect(onMakeReel).toHaveBeenCalled()
  })

  it('is disabled with fewer than 3 drops', () => {
    render(<KollabTile count={2} pendingCount={0} canDrop canStitch isPrivileged={false} uploading={false} onDrop={() => {}} onSee={() => {}} onMakeReel={() => {}} />)
    expect(screen.getByRole('button', { name: /make a reel/i })).toBeDisabled()
  })
})
