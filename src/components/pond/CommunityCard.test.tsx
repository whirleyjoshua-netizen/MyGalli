import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommunityCard } from './CommunityCard'
import type { PondCommunity } from '@/lib/pond'

const base: PondCommunity = {
  id: 'h1', title: 'Test Hub 1', username: 'me', slug: 'test-hub-1',
  coverImage: null, role: 'owner', memberCount: 2,
  latestPost: { text: 'Hello hello oooo', createdAt: new Date(Date.now() - 2 * 3600_000).toISOString() },
  updatedAt: new Date().toISOString(),
}

it('renders title, role, member count, description and activity', () => {
  render(<CommunityCard community={base} view="grid" />)
  expect(screen.getByText('Test Hub 1')).toBeInTheDocument()
  expect(screen.getByText('Owner')).toBeInTheDocument()
  expect(screen.getByText(/2 members/)).toBeInTheDocument()
  expect(screen.getByText('Hello hello oooo')).toBeInTheDocument()
  expect(screen.getByText(/Active .* ago/)).toBeInTheDocument()
})

it('links to the community public page', () => {
  render(<CommunityCard community={base} view="grid" />)
  expect(screen.getByRole('link')).toHaveAttribute('href', '/me/hub/test-hub-1')
})

it('shows "No posts yet" when there is no latest post', () => {
  render(<CommunityCard community={{ ...base, latestPost: null }} view="grid" />)
  expect(screen.getByText('No posts yet')).toBeInTheDocument()
})
