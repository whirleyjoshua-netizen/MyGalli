import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubAnnouncementBanner } from './HubAnnouncementBanner'
import type { AnnouncementDTO } from '@/lib/hub-announcements'

const ann = (over: Partial<AnnouncementDTO> = {}): AnnouncementDTO => ({
  id: 'a1', body: 'Meeting Thursday 6pm', createdAt: new Date().toISOString(),
  author: { username: 'o', name: 'Owner', avatar: null }, ...over,
})

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true }) })) as any
})

describe('HubAnnouncementBanner', () => {
  it('renders the most recent announcement', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[ann({ id: 'newest', body: 'Newest' }), ann({ id: 'older', body: 'Older' })]} />)
    expect(screen.getByText('Newest')).toBeInTheDocument()
    expect(screen.queryByText('Older')).not.toBeInTheDocument()
  })

  it('pages to the next announcement', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[ann({ id: 'newest', body: 'Newest' }), ann({ id: 'older', body: 'Older' })]} />)
    fireEvent.click(screen.getByRole('button', { name: /older|next/i }))
    expect(screen.getByText('Older')).toBeInTheDocument()
  })

  it('renders nothing for a member when there are no announcements', () => {
    const { container } = render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows a post prompt to a privileged viewer when empty', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged initial={[]} />)
    expect(screen.getByText(/post your first announcement|post an announcement/i)).toBeInTheDocument()
  })

  it('does not show a delete control to a member', () => {
    render(<HubAnnouncementBanner hubId="h1" isPrivileged={false} initial={[ann()]} />)
    expect(screen.queryByRole('button', { name: /delete|remove/i })).not.toBeInTheDocument()
  })
})
