import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileActionCards } from './ProfileActionCards'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/social/FollowButton', () => ({ FollowButton: () => <button>Follow</button> }))
vi.mock('@/components/profile/ProfileMailboxModal', () => ({
  ProfileMailboxModal: () => <div>visitor note composer</div>,
}))
vi.mock('@/components/profile/ProfileDmModal', () => ({
  ProfileDmModal: () => <div>dm composer</div>,
}))

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) })) as any
})

const props = { username: 'sarah', name: 'Sarah', isFollowing: false, isFriend: false }

describe('ProfileActionCards', () => {
  it('opens the DM composer for a logged-in visitor', () => {
    render(<ProfileActionCards isOwner={false} isLoggedIn {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Message/ }))
    expect(screen.getByText('dm composer')).toBeInTheDocument()
    expect(screen.queryByText('visitor note composer')).not.toBeInTheDocument()
  })

  it('opens the anonymous visitor composer for a logged-out visitor', () => {
    render(<ProfileActionCards isOwner={false} isLoggedIn={false} {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /Message/ }))
    expect(screen.getByText('visitor note composer')).toBeInTheDocument()
    expect(screen.queryByText('dm composer')).not.toBeInTheDocument()
  })

  it('shows no composer until the Message card is clicked', () => {
    render(<ProfileActionCards isOwner={false} isLoggedIn {...props} />)
    expect(screen.queryByText('dm composer')).not.toBeInTheDocument()
    expect(screen.queryByText('visitor note composer')).not.toBeInTheDocument()
  })

  it('shows the owner mailbox link instead of a Message button for the owner', () => {
    render(<ProfileActionCards isOwner isLoggedIn {...props} />)
    expect(screen.queryByRole('button', { name: /^Message/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Mailbox/ })).toHaveAttribute('href', '/messages')
  })
})
