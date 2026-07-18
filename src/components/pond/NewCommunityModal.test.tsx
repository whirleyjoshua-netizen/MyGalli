import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { NewCommunityModal } from './NewCommunityModal'

beforeEach(() => {
  vi.clearAllMocks()
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'newhub' }) }) as any
})

it('creates a community and navigates to its builder', async () => {
  render(<NewCommunityModal open onClose={() => {}} />)
  fireEvent.change(screen.getByPlaceholderText(/community name/i), { target: { value: 'My Club' } })
  fireEvent.click(screen.getByRole('button', { name: /create/i }))
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/hubs', expect.objectContaining({ method: 'POST' })))
  const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
  expect(body).toMatchObject({ title: 'My Club', community: true })
  await waitFor(() => expect(push).toHaveBeenCalledWith('/hubs/newhub'))
})

it('renders nothing when closed', () => {
  const { container } = render(<NewCommunityModal open={false} onClose={() => {}} />)
  expect(container).toBeEmptyDOMElement()
})
