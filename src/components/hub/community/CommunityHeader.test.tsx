import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityHeader } from './CommunityHeader'
import type { AnnouncementDTO } from '@/lib/hub-announcements'

const baseProps = {
  title: 'Info Hub', tagline: null, ownerUsername: 'o', coverImage: null,
  memberAvatars: [], counts: { posts: 0, members: 0, resources: 0, events: 0, kollab: 0 },
  joined: false, isPrivileged: false, onToggleJoin: () => {}, sharePath: '/o/hub/info',
  hubId: 'h1', announcements: [] as AnnouncementDTO[],
}

describe('CommunityHeader announcements', () => {
  it('renders an announcement banner in the header when present', () => {
    render(<CommunityHeader {...baseProps} announcements={[{ id: 'a1', body: 'Welcome all', createdAt: new Date().toISOString(), author: { username: 'o', name: 'O', avatar: null } }]} />)
    expect(screen.getByText('Welcome all')).toBeInTheDocument()
  })

  it('renders no banner and no prompt for a member when empty', () => {
    render(<CommunityHeader {...baseProps} announcements={[]} isPrivileged={false} />)
    expect(screen.queryByText(/announcement/i)).not.toBeInTheDocument()
  })
})
