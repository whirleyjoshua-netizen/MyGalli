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

  it('calls onReject with the drop id when Reject is clicked', async () => {
    const onReject = vi.fn()
    render(<KollabGrid {...base} mode="pending" onReject={onReject} drops={[drop({ id: 'x9', status: 'pending' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    expect(onReject).toHaveBeenCalledWith('x9')
  })

  it('calls onOpen with the entire drop object when a thumbnail is clicked', async () => {
    const onOpen = vi.fn()
    const testDrop = drop({ id: 'x9', caption: 'Test caption' })
    render(<KollabGrid {...base} mode="approved" onOpen={onOpen} drops={[testDrop]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test caption' }))
    expect(onOpen).toHaveBeenCalledWith(testDrop)
  })

  it('calls onRemove with the drop id when Remove is clicked in approved mode', async () => {
    const onRemove = vi.fn()
    render(<KollabGrid {...base} mode="approved" onRemove={onRemove} drops={[drop({ id: 'x9' })] } />)
    fireEvent.click(screen.getByTitle('Remove'))
    expect(onRemove).toHaveBeenCalledWith('x9')
  })

  it('shows Remove to a moderator when the drop is authored by someone else', () => {
    render(<KollabGrid {...base} mode="approved" isPrivileged={true} currentUserId="moderator" drops={[drop({ author: { userId: 'u2', username: 'other', name: 'Other', avatar: null } })]} />)
    expect(screen.getByTitle('Remove')).toBeInTheDocument()
  })

  it('shows Remove to the drop\'s author even without privilege', () => {
    render(<KollabGrid {...base} mode="approved" isPrivileged={false} currentUserId="u1" drops={[drop({ author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null } })]} />)
    expect(screen.getByTitle('Remove')).toBeInTheDocument()
  })

  it('hides Remove from a logged-in viewer who is not the author and not privileged', () => {
    render(<KollabGrid {...base} mode="approved" isPrivileged={false} currentUserId="u2" drops={[drop({ author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null } })]} />)
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument()
  })

  it('hides Remove from a logged-out viewer', () => {
    render(<KollabGrid {...base} mode="approved" isPrivileged={false} currentUserId={undefined} drops={[drop({ author: { userId: 'u1', username: 'sam', name: 'Sam', avatar: null } })]} />)
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument()
  })
})
