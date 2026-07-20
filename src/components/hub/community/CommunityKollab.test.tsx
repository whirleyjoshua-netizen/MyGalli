import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityKollab } from './CommunityKollab'
import type { DropDTO } from '@/lib/hub-drops'

const hiddenDrop: DropDTO = {
  id: 'd1',
  type: 'image',
  url: 'https://example.com/d1.jpg',
  thumbnailUrl: null,
  caption: null,
  mimeType: 'image/jpeg',
  width: null,
  height: null,
  hidden: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  author: { userId: 'u1', username: 'author1', name: null, avatar: null },
}

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({}) }) as any) as any
})

describe('CommunityKollab', () => {
  it('shows Pending indicator and Approve control for a privileged viewer on a hidden drop', () => {
    render(
      <CommunityKollab
        hubId="h1"
        hubTitle="Test Hub"
        canDrop={true}
        isPrivileged={true}
        currentUserId="mod1"
        enabled={true}
        initialDrops={[hiddenDrop]}
        total={1}
      />
    )
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByTitle('Approve')).toBeInTheDocument()
  })

  it('never shows Pending indicator or Approve control for a non-privileged viewer', () => {
    render(
      <CommunityKollab
        hubId="h1"
        hubTitle="Test Hub"
        canDrop={true}
        isPrivileged={false}
        currentUserId="visitor1"
        enabled={true}
        initialDrops={[hiddenDrop]}
        total={1}
      />
    )
    expect(screen.queryByText('Pending')).toBeNull()
    expect(screen.queryByTitle('Approve')).toBeNull()
  })
})
