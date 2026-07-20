import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CommunityUtilityStrip } from './CommunityUtilityStrip'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

const base = {
  hubId: 'h1', config: DEFAULT_HUB_CONFIG, notes: [], isOwner: false,
  isPrivileged: false, preview: true,
  activity: { newPosts: 0, newDrops: 0, newMembers: 0 }, joined: false,
  memberCount: 0, tagline: null, onToggleJoin: () => {},
  onOpenPoll: () => {}, onOpenEvents: () => {}, onOpenResources: () => {},
}

describe('CommunityUtilityStrip', () => {
  it('renders Notes and the activity card for a visitor', () => {
    render(<CommunityUtilityStrip {...base} />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Community')).toBeInTheDocument()
  })

  // Tools actions are owner surfaces; a visitor must not see the card at all.
  it('hides Tools from a visitor and shows it to a privileged viewer', () => {
    const { rerender } = render(<CommunityUtilityStrip {...base} />)
    expect(screen.queryByText('Tools')).toBeNull()
    rerender(<CommunityUtilityStrip {...base} isPrivileged />)
    expect(screen.getByText('Tools')).toBeInTheDocument()
  })

  it('respects per-card config toggles', () => {
    const config = { ...DEFAULT_HUB_CONFIG, utility: [
      { key: 'notes' as const, enabled: false },
      { key: 'activity' as const, enabled: true },
      { key: 'tools' as const, enabled: true },
    ] }
    render(<CommunityUtilityStrip {...base} config={config} isPrivileged />)
    expect(screen.queryByText('Notes')).toBeNull()
    expect(screen.getByText('This week')).toBeInTheDocument()
  })

  it('renders nothing when every card is disabled', () => {
    const config = { ...DEFAULT_HUB_CONFIG, utility: [
      { key: 'notes' as const, enabled: false },
      { key: 'activity' as const, enabled: false },
      { key: 'tools' as const, enabled: false },
    ] }
    const { container } = render(<CommunityUtilityStrip {...base} config={config} />)
    expect(container).toBeEmptyDOMElement()
  })
})

const notes = [
  { id: 'n1', title: 'Welcome', content: 'Share ideas and connect.', color: '#FDE047' },
  { id: 'n2', title: 'Rules', content: 'Be kind.', color: '#FDE047' },
  { id: 'n3', title: 'Third', content: 'Hidden behind view-all.', color: '#FDE047' },
]

describe('Notes card', () => {
  it('shows the first two notes and a view-all affordance', () => {
    render(<CommunityUtilityStrip {...base} notes={notes} />)
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Rules')).toBeInTheDocument()
    expect(screen.queryByText('Third')).toBeNull()
    expect(screen.getByText('View all notes →')).toBeInTheDocument()
  })

  it('hides the view-all affordance when everything already fits', () => {
    render(<CommunityUtilityStrip {...base} notes={notes.slice(0, 1)} />)
    expect(screen.queryByText('View all notes →')).toBeNull()
  })

  // The notes route is owner-only; a collaborator or visitor must not see "+".
  it('shows the add control only to the owner', () => {
    const { rerender } = render(<CommunityUtilityStrip {...base} notes={notes} isPrivileged />)
    expect(screen.queryByTitle('Add note')).toBeNull()
    rerender(<CommunityUtilityStrip {...base} notes={notes} isOwner />)
    expect(screen.getByTitle('Add note')).toBeInTheDocument()
  })

  it('invites the owner to write the first note when empty', () => {
    render(<CommunityUtilityStrip {...base} notes={[]} isOwner />)
    expect(screen.getByText('No notes yet.')).toBeInTheDocument()
  })
})

const activity = { newPosts: 4, newDrops: 7, newMembers: 2 }

describe('Activity card', () => {
  it('shows orientation and a join control to a visitor, not a pulse', () => {
    render(<CommunityUtilityStrip {...base} activity={activity} joined={false} memberCount={12} tagline="A test community" />)
    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument()
    expect(screen.getByText('A test community')).toBeInTheDocument()
    expect(screen.queryByText('4 new posts')).toBeNull()
  })

  it('shows the pulse to a member', () => {
    render(<CommunityUtilityStrip {...base} activity={activity} joined />)
    expect(screen.getByText('4 new posts')).toBeInTheDocument()
    expect(screen.getByText('7 clips added')).toBeInTheDocument()
    expect(screen.getByText('2 new members')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /join/i })).toBeNull()
  })

  it('shows the pulse to an owner even though they are not "joined"', () => {
    render(<CommunityUtilityStrip {...base} activity={activity} joined={false} isPrivileged isOwner />)
    expect(screen.getByText('4 new posts')).toBeInTheDocument()
  })

  it('invites a member to post when the week was quiet', () => {
    render(<CommunityUtilityStrip {...base} activity={{ newPosts: 0, newDrops: 0, newMembers: 0 }} joined />)
    expect(screen.getByText(/it's been quiet/i)).toBeInTheDocument()
  })

  it('calls the shared join handler rather than its own fetch', () => {
    const onToggleJoin = vi.fn()
    render(<CommunityUtilityStrip {...base} preview={false} activity={activity} joined={false} onToggleJoin={onToggleJoin} />)
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    expect(onToggleJoin).toHaveBeenCalledTimes(1)
  })

  // Preview contexts (e.g. the Hub Builder preview pane) must never trigger the
  // real join fetch just because the button happens to be clickable.
  it('does not call the join handler while in preview mode', () => {
    const onToggleJoin = vi.fn()
    render(<CommunityUtilityStrip {...base} preview activity={activity} joined={false} onToggleJoin={onToggleJoin} />)
    fireEvent.click(screen.getByRole('button', { name: /join/i }))
    expect(onToggleJoin).not.toHaveBeenCalled()
  })
})

describe('Tools card', () => {
  it('fires the matching callback for each tool for the owner', async () => {
    const onOpenPoll = vi.fn(), onOpenEvents = vi.fn(), onOpenResources = vi.fn()
    render(<CommunityUtilityStrip {...base} isPrivileged isOwner onOpenPoll={onOpenPoll} onOpenEvents={onOpenEvents} onOpenResources={onOpenResources} />)
    fireEvent.click(screen.getByRole('button', { name: 'Polls' }))
    fireEvent.click(screen.getByRole('button', { name: 'Events' }))
    fireEvent.click(screen.getByRole('button', { name: 'Files' }))
    fireEvent.click(screen.getByRole('button', { name: 'Links' }))
    expect(onOpenPoll).toHaveBeenCalledTimes(1)
    expect(onOpenEvents).toHaveBeenCalledTimes(1)
    expect(onOpenResources).toHaveBeenCalledTimes(2) // Files and Links share the manager
  })

  // Files/Links open a manager gated on ownHub server-side; a collaborator only
  // gets a working modal for Polls and Events.
  it('shows only Polls and Events to a non-owner collaborator', () => {
    render(<CommunityUtilityStrip {...base} isPrivileged isOwner={false} />)
    expect(screen.getByRole('button', { name: 'Polls' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Events' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Files' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Links' })).toBeNull()
  })
})
