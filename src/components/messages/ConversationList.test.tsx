import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConversationList } from './ConversationList'
import type { DmConversationSummary } from '@/lib/types/dm'

const convo = (over: Partial<DmConversationSummary> = {}): DmConversationSummary => ({
  id: 'c1',
  state: 'accepted',
  starred: false,
  muted: false,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  other: { id: 'u2', username: 'sarah', name: 'Sarah Johnson', avatar: null, lastSeenAt: null, followsYou: false },
  preview: { body: 'Love your page!', kind: 'text', senderId: 'u2', createdAt: new Date().toISOString() },
  ...over,
})

describe('ConversationList', () => {
  it('renders the other person’s name and the last message preview', () => {
    render(<ConversationList conversations={[convo()]} activeId={null} onSelect={() => {}} loading={false} />)
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument()
    expect(screen.getByText('Love your page!')).toBeInTheDocument()
  })

  it('falls back to the @username when there is no display name', () => {
    render(
      <ConversationList
        conversations={[convo({ other: { id: 'u2', username: 'sarah', name: null, avatar: null, lastSeenAt: null, followsYou: false } })]}
        activeId={null}
        onSelect={() => {}}
        loading={false}
      />
    )
    expect(screen.getByText('@sarah')).toBeInTheDocument()
  })

  it('shows an unread pill only when there are unread messages', () => {
    const { rerender } = render(
      <ConversationList conversations={[convo({ unreadCount: 2 })]} activeId={null} onSelect={() => {}} loading={false} />
    )
    expect(screen.getByText('2')).toBeInTheDocument()
    rerender(
      <ConversationList conversations={[convo({ unreadCount: 0 })]} activeId={null} onSelect={() => {}} loading={false} />
    )
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })

  it('marks the online dot when the other person was seen recently', () => {
    render(
      <ConversationList
        conversations={[convo({ other: { id: 'u2', username: 'sarah', name: 'Sarah', avatar: null, lastSeenAt: new Date().toISOString(), followsYou: false } })]}
        activeId={null}
        onSelect={() => {}}
        loading={false}
      />
    )
    expect(screen.getByLabelText('Online')).toBeInTheDocument()
  })

  it('calls onSelect with the conversation id when clicked', () => {
    const onSelect = vi.fn()
    render(<ConversationList conversations={[convo()]} activeId={null} onSelect={onSelect} loading={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Sarah Johnson/ }))
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('shows an empty message when there are no conversations', () => {
    render(<ConversationList conversations={[]} activeId={null} onSelect={() => {}} loading={false} />)
    expect(screen.getByText(/No conversations yet/i)).toBeInTheDocument()
  })
})
