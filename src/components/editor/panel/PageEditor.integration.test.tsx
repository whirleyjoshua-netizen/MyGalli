import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PageEditor } from '@/components/editor/PageEditor'

// PageEditor calls useRouter() at the top level; stub the app-router hooks.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/editor',
  useSearchParams: () => new URLSearchParams(),
}))

// Minimal fetch stub: load an existing page with two sections.
const page = {
  id: 'p1', title: 'My Page', slug: 'my-page', published: false, version: 1, isOwner: true,
  category: null, coverImage: null,
  sections: [
    { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'heading', content: 'Hi', level: 2 }] }] },
  ],
  background: null, spacing: null, headerCard: null, tabs: null, kitConfig: null,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
    if (url === '/api/displays/p1' && (!opts || opts.method === undefined)) {
      return { ok: true, status: 200, json: async () => page } as any
    }
    return { ok: true, status: 200, json: async () => ({ version: 2 }) } as any
  }))
})

describe('PageEditor renders the control panel', () => {
  it('shows the Elements list with the page element and hides old top-bar buttons', async () => {
    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())
    // Elements/Page tabs exist
    expect(screen.getByRole('button', { name: /elements/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^page$/i })).toBeInTheDocument()
    // Old top-bar buttons are gone (moved into Page tab)
    expect(screen.queryByRole('button', { name: /^Background$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Spacing$/ })).not.toBeInTheDocument()
  })

  it('collapsing the panel toggles to a rail with an expand control', async () => {
    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /collapse panel/i }))
    expect(screen.getByRole('button', { name: /expand panel/i })).toBeInTheDocument()
  })
})
