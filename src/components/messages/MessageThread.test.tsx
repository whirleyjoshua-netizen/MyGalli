import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageThread } from './MessageThread'
import type { DmConversationSummary, DmMessage } from '@/lib/types/dm'

const conversation: DmConversationSummary = {
  id: 'c1',
  state: 'accepted',
  starred: false,
  muted: false,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  other: { id: 'them', username: 'sarah', name: 'Sarah Johnson', avatar: null, lastSeenAt: null, followsYou: false },
  preview: null,
}

const msg = (over: Partial<DmMessage> = {}): DmMessage => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'them',
  kind: 'text',
  body: 'Hey Josh!',
  mediaUrl: null,
  createdAt: new Date().toISOString(),
  ...over,
})

describe('MessageThread', () => {
  it('renders the other person in the header', () => {
    render(<MessageThread messages={[]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument()
  })

  it('renders message bodies', () => {
    render(<MessageThread messages={[msg()]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Hey Josh!')).toBeInTheDocument()
  })

  it('shows a Today separator for messages sent today', () => {
    render(<MessageThread messages={[msg()]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('separates messages from different days', () => {
    const older = msg({ id: 'm0', createdAt: new Date(2026, 0, 5).toISOString() })
    render(<MessageThread messages={[older, msg()]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getAllByTestId('day-separator')).toHaveLength(2)
  })

  it('offers a retry on a failed message', () => {
    const onRetry = vi.fn()
    render(
      <MessageThread
        messages={[msg({ senderId: 'me', failed: true })]}
        myId="me"
        conversation={conversation}
        onRetry={onRetry}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('prompts to say hello when the thread is empty', () => {
    render(<MessageThread messages={[]} myId="me" conversation={conversation} onRetry={() => {}} />)
    expect(screen.getByText(/No messages yet/i)).toBeInTheDocument()
  })

  it('auto-scrolls to the bottom when a new message arrives while pinned to the bottom', () => {
    const first = [msg({ id: 'm1' })]
    const { container, rerender } = render(
      <MessageThread messages={first} myId="me" conversation={conversation} onRetry={() => {}} />
    )
    const scrollEl = container.querySelector('.overflow-y-auto') as HTMLDivElement
    expect(scrollEl).toBeTruthy()

    // Simulate layout: reader is at the very bottom.
    Object.defineProperty(scrollEl, 'scrollHeight', { configurable: true, value: 500 })
    Object.defineProperty(scrollEl, 'clientHeight', { configurable: true, value: 300 })
    scrollEl.scrollTop = 200 // 500 - 200 - 300 = 0 < 80 => pinned
    fireEvent.scroll(scrollEl)

    // A new message arrives and grows the content.
    const second = [...first, msg({ id: 'm2', body: 'Second message' })]
    Object.defineProperty(scrollEl, 'scrollHeight', { configurable: true, value: 800 })
    rerender(<MessageThread messages={second} myId="me" conversation={conversation} onRetry={() => {}} />)

    expect(scrollEl.scrollTop).toBe(800)
  })

  it('does not yank the reader down when they have scrolled up into history', () => {
    const first = [msg({ id: 'm1' })]
    const { container, rerender } = render(
      <MessageThread messages={first} myId="me" conversation={conversation} onRetry={() => {}} />
    )
    const scrollEl = container.querySelector('.overflow-y-auto') as HTMLDivElement
    expect(scrollEl).toBeTruthy()

    // Simulate layout: reader has scrolled well up into history.
    Object.defineProperty(scrollEl, 'scrollHeight', { configurable: true, value: 1000 })
    Object.defineProperty(scrollEl, 'clientHeight', { configurable: true, value: 300 })
    scrollEl.scrollTop = 100 // 1000 - 100 - 300 = 600 >= 80 => not pinned
    fireEvent.scroll(scrollEl)

    // A new message arrives and grows the content.
    const second = [...first, msg({ id: 'm2', body: 'Second message' })]
    Object.defineProperty(scrollEl, 'scrollHeight', { configurable: true, value: 1300 })
    rerender(<MessageThread messages={second} myId="me" conversation={conversation} onRetry={() => {}} />)

    expect(scrollEl.scrollTop).toBe(100)
  })
})
