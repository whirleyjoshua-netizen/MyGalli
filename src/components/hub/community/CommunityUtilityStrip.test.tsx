import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityUtilityStrip } from './CommunityUtilityStrip'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

const base = {
  hubId: 'h1', config: DEFAULT_HUB_CONFIG, notes: [], isOwner: false,
  isPrivileged: false, preview: true,
  onOpenPoll: () => {}, onOpenEvents: () => {}, onOpenResources: () => {},
}

describe('CommunityUtilityStrip', () => {
  it('renders Notes and Kollab AI for a visitor', () => {
    render(<CommunityUtilityStrip {...base} />)
    expect(screen.getByText('Notes')).toBeInTheDocument()
    expect(screen.getByText('Kollab AI')).toBeInTheDocument()
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
      { key: 'ai' as const, enabled: true },
      { key: 'tools' as const, enabled: true },
    ] }
    render(<CommunityUtilityStrip {...base} config={config} isPrivileged />)
    expect(screen.queryByText('Notes')).toBeNull()
    expect(screen.getByText('Kollab AI')).toBeInTheDocument()
  })

  it('renders nothing when every card is disabled', () => {
    const config = { ...DEFAULT_HUB_CONFIG, utility: [
      { key: 'notes' as const, enabled: false },
      { key: 'ai' as const, enabled: false },
      { key: 'tools' as const, enabled: false },
    ] }
    const { container } = render(<CommunityUtilityStrip {...base} config={config} />)
    expect(container).toBeEmptyDOMElement()
  })

  // The M4 slot must read as deliberate, not broken.
  it('shows the AI prompt as disabled with a coming-soon label', () => {
    render(<CommunityUtilityStrip {...base} />)
    expect(screen.getByPlaceholderText('Ask Kollab AI anything…')).toBeDisabled()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
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
