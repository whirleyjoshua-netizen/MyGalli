import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { HubPagesTab } from './HubPagesTab'
import type { HubPageDTO } from '@/lib/hub-pages'

const approved: HubPageDTO = {
  id: 'hp1', displayId: 'd1', title: 'Approved Page', slug: 'approved-page',
  coverImage: null, ownerUsername: 'jo', status: 'approved', addedById: 'u1',
  createdAt: '2026-07-22T00:00:00.000Z',
}
const pending: HubPageDTO = { ...approved, id: 'hp2', displayId: 'd2', title: 'Pending Page', slug: 'pending-page', status: 'pending', addedById: 'u2' }

beforeEach(() => { vi.restoreAllMocks() })

it('renders an approved page with a link to it', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u1" initialPages={[approved]} />)
  expect(screen.getByRole('link', { name: /approved page/i })).toHaveAttribute('href', '/jo/approved-page')
})

it('shows the review queue to a moderator', () => {
  render(<HubPagesTab hubId="h1" canManage currentUserId="mod" initialPages={[approved, pending]} />)
  expect(screen.getByText(/needs review/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
})

it('hides the review queue from a plain member', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u1" initialPages={[approved]} />)
  expect(screen.queryByText(/needs review/i)).not.toBeInTheDocument()
})

it('badges the attacher own pending row', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u2" initialPages={[approved, pending]} />)
  const listItem = screen.getByText('Pending Page').closest('li')
  expect(listItem).toBeTruthy()
  if (listItem) {
    expect(within(listItem).getByText(/^pending$/i)).toBeInTheDocument()
  }
})

it('shows a moderator their own rejected row without duplicating their own pending row from the queue', () => {
  const modPending: HubPageDTO = { ...pending, id: 'hp3', displayId: 'd3', title: 'Mod Pending Page', addedById: 'mod' }
  const modRejected: HubPageDTO = { ...pending, id: 'hp4', displayId: 'd4', title: 'Mod Rejected Page', status: 'rejected', addedById: 'mod' }
  render(<HubPagesTab hubId="h1" canManage currentUserId="mod" initialPages={[approved, pending, modPending, modRejected]} />)

  // The rejected row belonging to the moderator must not silently vanish.
  expect(screen.getByText('Mod Rejected Page')).toBeInTheDocument()

  // The moderator's own pending row lives in the review queue and must appear only once.
  expect(screen.getAllByText('Mod Pending Page')).toHaveLength(1)
  const queueSection = screen.getByText(/needs review/i).closest('section')
  expect(queueSection).toBeTruthy()
  if (queueSection) {
    expect(within(queueSection).getByText('Mod Pending Page')).toBeInTheDocument()
  }
})

it('shows an empty state when nothing is attached', () => {
  render(<HubPagesTab hubId="h1" canManage={false} currentUserId="u1" initialPages={[]} />)
  expect(screen.getByText(/no pages yet/i)).toBeInTheDocument()
})
