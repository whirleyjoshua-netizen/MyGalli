import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { FollowListModal } from './FollowListModal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/social/FollowButton', () => ({
  FollowButton: ({ username }: { username: string }) => <button>Follow {username}</button>,
}))
vi.mock('@/components/profile/ProfileDmModal', () => ({
  ProfileDmModal: ({ username, onSent }: { username: string; onSent?: () => void }) => (
    <div>
      composer for {username}
      <button onClick={() => onSent?.()}>fake send</button>
    </div>
  ),
}))

const users = { users: [{ username: 'sarah', name: 'Sarah Johnson', avatar: null, isFollowing: true }] }

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => users })) as any
})

describe('FollowListModal', () => {
  it('lists the people returned for the requested mode', async () => {
    render(<FollowListModal isOpen onClose={vi.fn()} username="josh" mode="followers" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
    expect(global.fetch).toHaveBeenCalledWith('/api/users/josh/followers')
  })

  it('renders nothing when closed', () => {
    render(<FollowListModal isOpen={false} onClose={vi.fn()} username="josh" mode="followers" />)
    expect(screen.queryByRole('heading', { name: /followers/i })).not.toBeInTheDocument()
  })

  // Regression: the dashboard sidebar is `position: sticky`, which ALWAYS
  // creates a stacking context. Rendered in place, the fixed overlay stayed
  // trapped beneath the main content — page cards painted over the dialog and
  // the backdrop dimmed nothing. Portalling to <body> is what fixes it, so
  // assert the dialog is NOT a descendant of the caller's subtree.
  it('escapes the caller subtree so a stacking-context ancestor cannot trap it', async () => {
    const { container } = render(
      <div style={{ position: 'sticky' }}>
        <FollowListModal isOpen onClose={vi.fn()} username="josh" mode="followers" />
      </div>
    )
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
    expect(container.querySelector('.fixed')).toBeNull()
    expect(document.body.querySelector('.fixed')).not.toBeNull()
  })

  it('shows no Message button by default', async () => {
    render(<FollowListModal isOpen onClose={vi.fn()} username="josh" mode="followers" />)
    await waitFor(() => expect(screen.getByText('Sarah Johnson')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /message sarah/i })).not.toBeInTheDocument()
  })

  it('shows a Message button per row when canMessage is set', async () => {
    render(<FollowListModal isOpen onClose={vi.fn()} username="josh" mode="followers" canMessage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /message sarah/i })).toBeInTheDocument())
  })

  it('opens the composer in place when Message is clicked', async () => {
    render(<FollowListModal isOpen onClose={vi.fn()} username="josh" mode="followers" canMessage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /message sarah/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /message sarah/i }))
    expect(screen.getByText(/composer for sarah/i)).toBeInTheDocument()
  })

  it('returns to the list after sending, without closing the list', async () => {
    const onClose = vi.fn()
    render(<FollowListModal isOpen onClose={onClose} username="josh" mode="followers" canMessage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /message sarah/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /message sarah/i }))
    fireEvent.click(screen.getByText('fake send'))

    await waitFor(() => expect(screen.queryByText(/composer for sarah/i)).not.toBeInTheDocument())
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('still offers follow/unfollow alongside Message', async () => {
    render(<FollowListModal isOpen onClose={vi.fn()} username="josh" mode="followers" canMessage />)
    await waitFor(() => expect(screen.getByText('Follow sarah')).toBeInTheDocument())
  })
})
