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

describe('PageEditor "show last updated" toggle', () => {
  it('PATCHes only { showLastUpdated: true } (no sections/version) when flipped on', async () => {
    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^page$/i }))
    const toggle = await screen.findByRole('switch', { name: /show when this page was last updated/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))

    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>
    const toggleCall = fetchMock.mock.calls.find(
      (call: any[]) =>
        call[0] === '/api/displays/p1' &&
        call[1]?.method === 'PATCH' &&
        JSON.parse(call[1].body).showLastUpdated !== undefined
    )
    expect(toggleCall).toBeDefined()
    const body = JSON.parse(toggleCall![1].body)
    expect(body).toEqual({ showLastUpdated: true })
  })

  it('rolls back the switch when the PATCH responds !ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
      if (url === '/api/displays/p1' && (!opts || opts.method === undefined)) {
        return { ok: true, status: 200, json: async () => page } as any
      }
      if (opts?.method === 'PATCH' && JSON.parse(opts.body).showLastUpdated !== undefined) {
        return { ok: false, status: 500, json: async () => ({ error: 'boom' }) } as any
      }
      return { ok: true, status: 200, json: async () => ({ version: 2 }) } as any
    }))

    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^page$/i }))
    const toggle = await screen.findByRole('switch', { name: /show when this page was last updated/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)
    // Optimistic flip happens synchronously with state update
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    // Then rolls back once the failed PATCH resolves
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })

  it('rolls back the switch when the PATCH throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
      if (url === '/api/displays/p1' && (!opts || opts.method === undefined)) {
        return { ok: true, status: 200, json: async () => page } as any
      }
      if (opts?.method === 'PATCH' && JSON.parse(opts.body).showLastUpdated !== undefined) {
        throw new Error('network down')
      }
      return { ok: true, status: 200, json: async () => ({ version: 2 }) } as any
    }))

    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^page$/i }))
    const toggle = await screen.findByRole('switch', { name: /show when this page was last updated/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'))
  })
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

  it('clicking the element on the canvas reveals its inspector in the panel', async () => {
    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())

    // Switch the panel to the Page tab so the Elements inspector is not already showing.
    fireEvent.click(screen.getByRole('button', { name: /^page$/i }))
    expect(screen.queryByText(/settings for this element/i)).not.toBeInTheDocument()

    // "Hi" (exact) only matches the canvas heading's contentEditable node — the panel
    // row renders "Heading — Hi", a different string. Clicking it exercises the real
    // ColumnCanvas -> onSelectElement -> PageEditor selection path (Fix 1).
    fireEvent.click(screen.getByText('Hi'))

    await waitFor(() =>
      expect(screen.getByText(/settings for this element/i)).toBeInTheDocument()
    )
  })
})

describe('PageEditor autosave', () => {
  // An idle editor must not PATCH. Task 3 stamps contentUpdatedAt whenever a
  // visible field is present in the payload, so a redundant autosave would make
  // the public "last updated" badge report when the editor was last OPEN rather
  // than when the page last CHANGED.
  it('does not PATCH when an autosave would send an unchanged payload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<PageEditor pageId="p1" />)

      // Let the initial load settle.
      await waitFor(() => expect(screen.getByDisplayValue('My Page')).toBeInTheDocument())

      const patchCount = () =>
        (fetch as any).mock.calls.filter((c: any[]) => c[1]?.method === 'PATCH').length

      // First autosave tick: the editor may legitimately save once.
      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => expect(patchCount()).toBeLessThanOrEqual(1))
      const afterFirst = patchCount()

      // Nothing was edited, so further ticks must issue no further PATCHes.
      await vi.advanceTimersByTimeAsync(15000)
      expect(patchCount()).toBe(afterFirst)
    } finally {
      vi.useRealTimers()
    }
  })
})
