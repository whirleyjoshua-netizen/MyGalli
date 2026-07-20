import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { HubResourcesModal } from './HubResourcesModal'

const items = [
  { id: 'i1', type: 'file', title: 'Welcome Guide.pdf', url: 'https://x/y.pdf' },
  { id: 'i2', type: 'link', title: 'Useful Links', url: 'https://example.com' },
  { id: 'i3', type: 'note', title: 'Not a resource', url: null },
]

beforeEach(() => {
  vi.restoreAllMocks()
  global.fetch = vi.fn(async (url: any, init?: any) => {
    if (String(url).endsWith('/api/hubs/h1')) return { ok: true, json: async () => ({ items }) } as any
    if (init?.method === 'POST') return { ok: true, status: 201, json: async () => ({ id: 'i9', type: 'link', title: 'New Link', url: 'https://new.test' }) } as any
    return { ok: true, json: async () => ({}) } as any
  }) as any
})

describe('HubResourcesModal', () => {
  it('lists only file and link items', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    expect(await screen.findByText('Welcome Guide.pdf')).toBeInTheDocument()
    expect(screen.getByText('Useful Links')).toBeInTheDocument()
    expect(screen.queryByText('Not a resource')).toBeNull()
  })

  it('adds a link through the items API', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    await screen.findByText('Welcome Guide.pdf')
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New Link' } })
    fireEvent.change(screen.getByPlaceholderText('https://…'), { target: { value: 'https://new.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      const call = (global.fetch as any).mock.calls.find((c: any[]) => c[1]?.method === 'POST')
      expect(call[0]).toBe('/api/hubs/h1/items')
      expect(JSON.parse(call[1].body)).toMatchObject({ type: 'link', title: 'New Link', url: 'https://new.test' })
    })
  })

  it('requires a title before Add is enabled', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    await screen.findByText('Welcome Guide.pdf')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('requires a url before Add is enabled', async () => {
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    await screen.findByText('Welcome Guide.pdf')
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New Link' } })
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
  })

  it('shows an error message when adding fails', async () => {
    global.fetch = vi.fn(async (url: any, init?: any) => {
      if (String(url).endsWith('/api/hubs/h1')) return { ok: true, json: async () => ({ items }) } as any
      if (init?.method === 'POST') return { ok: false, status: 500, json: async () => ({ error: 'Could not add resource' }) } as any
      return { ok: true, json: async () => ({}) } as any
    }) as any
    render(<HubResourcesModal hubId="h1" onClose={() => {}} />)
    await screen.findByText('Welcome Guide.pdf')
    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New Link' } })
    fireEvent.change(screen.getByPlaceholderText('https://…'), { target: { value: 'https://new.test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Could not add resource')).toBeInTheDocument()
    expect(screen.queryByText('New Link')).toBeNull()
  })
})
