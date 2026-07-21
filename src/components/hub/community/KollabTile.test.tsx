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

  it('disables See content when the pool is empty', () => {
    render(<KollabTile {...base} count={0} />)
    expect(screen.getByRole('button', { name: /see content/i })).toBeDisabled()
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
