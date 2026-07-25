import { it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HubPageAttachModal } from './HubPageAttachModal'

const displays = [
  { id: 'd1', title: 'Published One', slug: 'published-one', published: true, kind: 'page' },
  { id: 'd2', title: 'A Draft', slug: 'a-draft', published: false, kind: 'page' },
  { id: 'd3', title: 'A Board', slug: 'a-board', published: true, kind: 'collection' },
  { id: 'd4', title: 'Already There', slug: 'already-there', published: true, kind: 'page' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => displays })) as any)
})

it('lists published Pages as selectable', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={['d4']} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /published one/i })).toBeEnabled())
})

it('disables drafts with a publish-first hint', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={[]} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /a draft/i })).toBeDisabled())
  expect(screen.getByText(/publish first/i)).toBeInTheDocument()
})

it('omits Boards entirely', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={[]} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /published one/i })).toBeInTheDocument())
  expect(screen.queryByText(/a board/i)).not.toBeInTheDocument()
})

it('disables an already-attached Page', async () => {
  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={['d4']} onClose={() => {}} onAttached={() => {}} />)
  await waitFor(() => expect(screen.getByRole('button', { name: /already there/i })).toBeDisabled())
  expect(screen.getByText(/already added/i)).toBeInTheDocument()
})

it('recovers from a network failure: surfaces an error and re-enables the button', async () => {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url === '/api/displays') return { ok: true, json: async () => displays }
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', fetchMock)

  render(<HubPageAttachModal hubId="h1" attachedDisplayIds={[]} onClose={() => {}} onAttached={() => {}} />)
  const button = await screen.findByRole('button', { name: /published one/i })
  expect(button).toBeEnabled()

  fireEvent.click(button)

  await waitFor(() => expect(button).toBeEnabled())
  expect(screen.getByText(/could not attach that page/i)).toBeInTheDocument()
})
