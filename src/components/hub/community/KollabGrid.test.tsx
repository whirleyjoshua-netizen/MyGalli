import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KollabGrid } from './KollabGrid'
import type { DropDTO } from '@/lib/hub-drops'

const drop = (over: Partial<DropDTO> = {}): DropDTO => ({
  id: 'd1', type: 'image', url: 'https://x/a.jpg', thumbnailUrl: null, caption: null,
  mimeType: null, width: null, height: null, status: 'approved',
  createdAt: '2026-07-21T00:00:00.000Z',
  author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null },
  ...over,
})

const base = {
  hubId: 'hub1', currentUserId: 'owner', isPrivileged: true,
  onOpen: () => {}, onApprove: () => {}, onReject: () => {}, onRemove: () => {},
}

describe('KollabGrid', () => {
  it('renders approve and reject only in pending mode', () => {
    const { rerender } = render(<KollabGrid {...base} mode="approved" drops={[drop()]} />)
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    rerender(<KollabGrid {...base} mode="pending" drops={[drop({ status: 'pending' })]} />)
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
  })

  it('names the author in pending mode so a moderator knows who dropped it', () => {
    render(<KollabGrid {...base} mode="pending" drops={[drop({ status: 'pending' })]} />)
    expect(screen.getByText('Sam')).toBeInTheDocument()
  })

  it('calls onApprove with the drop id', async () => {
    const onApprove = vi.fn()
    render(<KollabGrid {...base} mode="pending" onApprove={onApprove} drops={[drop({ id: 'x9', status: 'pending' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    expect(onApprove).toHaveBeenCalledWith('x9')
  })

  it('shows an empty message when there is nothing in this tab', () => {
    render(<KollabGrid {...base} mode="pending" drops={[]} />)
    expect(screen.getByText('Nothing waiting for review.')).toBeInTheDocument()
  })
})
