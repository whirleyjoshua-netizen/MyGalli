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
  // An autosave PATCH carries `sections`/`background`/etc; the toggle's own
  // PATCH carries only `{ showLastUpdated }`. Filter on the payload shape,
  // not just the method, so the toggle test above can't contaminate counts
  // and vice versa.
  const autosavePatchCount = (fetchMock: any) =>
    fetchMock.mock.calls.filter(
      (c: any[]) => c[1]?.method === 'PATCH' && JSON.parse(c[1].body).sections !== undefined
    ).length

  // An idle editor must not PATCH at all. Task 3 stamps contentUpdatedAt
  // whenever a visible field is present in the payload, so even a single
  // redundant autosave would make the public "last updated" badge report
  // when the editor was last OPEN rather than when the page last CHANGED.
  // lastSavedPayloadRef is now seeded from loadPage's own normalised state,
  // so the very first tick already matches and is skipped — zero PATCHes,
  // not "at most one".
  it('does not PATCH when an autosave would send an unchanged payload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<PageEditor pageId="p1" />)

      // Let the initial load settle.
      await waitFor(() => expect(screen.getByDisplayValue('My Page')).toBeInTheDocument())

      // Nothing was edited across multiple ticks: no autosave PATCH ever fires.
      await vi.advanceTimersByTimeAsync(5000)
      await vi.advanceTimersByTimeAsync(15000)
      expect(autosavePatchCount(fetch as any)).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })

  // Lower bound: a real content edit MUST still autosave. Without this test,
  // a regression that wedges savePage into always skipping would pass every
  // other test in this file (the toggle tests bypass savePage entirely; the
  // idle test above only proves the *unchanged* case is skipped).
  it('PATCHes with the edited content after a real change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<PageEditor pageId="p1" />)
      await waitFor(() => expect(screen.getByDisplayValue('My Page')).toBeInTheDocument())

      // Make a real content edit: change the page title.
      const titleInput = screen.getByDisplayValue('My Page')
      fireEvent.change(titleInput, { target: { value: 'Edited Title' } })
      await waitFor(() => expect(screen.getByDisplayValue('Edited Title')).toBeInTheDocument())

      await vi.advanceTimersByTimeAsync(5000)

      await vi.waitFor(() => {
        expect(autosavePatchCount(fetch as any)).toBeGreaterThan(0)
      })

      const fetchMock = fetch as any
      const autosaveCall = fetchMock.mock.calls.find(
        (c: any[]) => c[1]?.method === 'PATCH' && JSON.parse(c[1].body).sections !== undefined
      )
      expect(autosaveCall).toBeDefined()
      const body = JSON.parse(autosaveCall![1].body)
      expect(body.title).toBe('Edited Title')
    } finally {
      vi.useRealTimers()
    }
  })
})

// Finding 1, end-to-end: the stamp endpoint's write bumps the display's
// version, but the editor never learned the new value — so the very next
// autosave still carried the version it loaded with, got 409'd against its
// OWN edit, and (because savePage early-returns while `conflict` is set)
// autosave stayed dead for the rest of the session. This must fail against
// the pre-fix PageEditor/ElementRow, which never read `version` off the
// stamp response.
describe('PageEditor stamp keeps autosave alive', () => {
  it('records the version from a Stamp write so the next autosave is not stale', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
      if (url === '/api/displays/p1' && (!opts || opts.method === undefined)) {
        return { ok: true, status: 200, json: async () => page } as any
      }
      if (typeof url === 'string' && url.includes('/stamp') && opts?.method === 'POST') {
        return {
          ok: true, status: 200,
          json: async () => ({ stampedAt: '2026-07-23T12:00:00.000Z', stampedTz: 'UTC', version: 2 }),
        } as any
      }
      return { ok: true, status: 200, json: async () => ({ version: 2 }) } as any
    }))

    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<PageEditor pageId="p1" />)
      await waitFor(() => expect(screen.getByDisplayValue('My Page')).toBeInTheDocument())

      // Expand the element row to reveal the Stamp control, then stamp it.
      fireEvent.click(screen.getByRole('button', { name: /Heading — Hi/i }))
      const stampButton = await screen.findByRole('button', { name: /^stamp$/i })
      fireEvent.click(stampButton)

      // Wait for the stamp POST to resolve and the element to render as stamped.
      await screen.findByRole('button', { name: /re-stamp/i })

      await vi.advanceTimersByTimeAsync(5000)

      const fetchMock = fetch as any
      const autosaveCall = fetchMock.mock.calls
        .filter((c: any[]) => c[1]?.method === 'PATCH' && JSON.parse(c[1].body).sections !== undefined)
        .pop()
      expect(autosaveCall).toBeDefined()
      const body = JSON.parse(autosaveCall![1].body)
      // Loaded at version 1; the stamp POST reported back version 2. The
      // pre-fix editor would still send 1 here (stale — a 409 against itself).
      expect(body.version).toBe(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
