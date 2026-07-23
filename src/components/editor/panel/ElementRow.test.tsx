import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ElementRow } from './ElementRow'

const row = { sectionId: 's1', columnId: 'c1', element: { id: 'e1', type: 'image' as const, url: 'https://x/hero.jpg' } }

describe('ElementRow', () => {
  it('renders the row label and hides inspector when collapsed', () => {
    render(<ElementRow row={row} expanded={false} displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByText('Image — hero.jpg')).toBeInTheDocument()
    expect(screen.queryByText(/settings for this element/i)).not.toBeInTheDocument()
  })
  it('calls onToggle when the row header is clicked', () => {
    const onToggle = vi.fn()
    render(<ElementRow row={row} expanded={false} displayId="d1" onToggle={onToggle} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Image — hero\.jpg/ }))
    expect(onToggle).toHaveBeenCalled()
  })
  it('renders the ImageInspector when expanded', () => {
    render(<ElementRow row={row} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByLabelText(/image url/i)).toBeInTheDocument()
  })
})

describe('ElementRow stamp control', () => {
  const base = { sectionId: 's1', columnId: 'c1' }
  const unstamped = { ...base, element: { id: 'e1', type: 'text' as const, content: 'hi' } }
  const stamped = {
    ...base,
    element: {
      id: 'e1', type: 'text' as const, content: 'hi',
      stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC',
    },
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC' }),
    })) as any)
  })

  it('shows Stamp when the element is unstamped', () => {
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('button', { name: /^stamp$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove stamp/i })).not.toBeInTheDocument()
  })

  it('shows the value, Re-stamp and Remove when stamped', () => {
    render(<ElementRow row={stamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('time')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /re-stamp/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove stamp/i })).toBeInTheDocument()
  })

  it('applies the SERVER response via onChange rather than a locally-made time', async () => {
    const onChange = vi.fn()
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({
      stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC',
    }))
  })

  it('applies nothing when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any)
    const onChange = vi.fn()
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^stamp$/i })).toBeEnabled())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies nothing when the request rejects outright', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }) as any)
    const onChange = vi.fn()
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^stamp$/i })).toBeEnabled())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears both fields on Remove', async () => {
    const onChange = vi.fn()
    render(<ElementRow row={stamped} expanded displayId="d1" onToggle={() => {}} onChange={onChange} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /remove stamp/i }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith({
      stampedAt: undefined, stampedTz: undefined,
    }))
  })

  // The control must not depend on the inspector registry. 'text' falls back to
  // DefaultInspector; 'image' has a custom ImageInspector.
  it('renders for a type WITHOUT a custom inspector', () => {
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('button', { name: /^stamp$/i })).toBeInTheDocument()
  })

  it('renders for a type WITH a custom inspector', () => {
    const imageRow = { ...base, element: { id: 'e9', type: 'image' as const, url: 'https://x/a.jpg' } }
    render(<ElementRow row={imageRow} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByRole('button', { name: /^stamp$/i })).toBeInTheDocument()
  })

  // Finding 1: the stamp write bumps the display's version server-side. If
  // the caller never learns the new value, the editor's own versionRef stays
  // stale and its next autosave 409s against its own edit. This fails against
  // the pre-fix ElementRow, which never reads `version` off the response or
  // accepts a callback to report it.
  it('reports the version returned by a successful stamp', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC', version: 4 }),
    })) as any)
    const onVersionChange = vi.fn()
    render(
      <ElementRow
        row={unstamped} expanded displayId="d1"
        onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false}
        onVersionChange={onVersionChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(onVersionChange).toHaveBeenCalledWith(4))
  })

  it('reports the version returned by a successful Remove', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, version: 9 }),
    })) as any)
    const onVersionChange = vi.fn()
    render(
      <ElementRow
        row={stamped} expanded displayId="d1"
        onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false}
        onVersionChange={onVersionChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /remove stamp/i }))
    await waitFor(() => expect(onVersionChange).toHaveBeenCalledWith(9))
  })

  // Finding 2b: a failed stamp request currently does nothing visible —
  // the button just re-enables. Surface a minimal inline error instead.
  it('shows an inline error when the stamp request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })) as any)
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByText(/couldn.t save the stamp/i)).toBeInTheDocument())
  })

  it('shows an inline error when the stamp request rejects outright', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }) as any)
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByText(/couldn.t save the stamp/i)).toBeInTheDocument())
  })

  it('clears a prior error on a subsequent successful stamp', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ stampedAt: '2026-07-23T23:30:00.000Z', stampedTz: 'UTC' }) })
    vi.stubGlobal('fetch', fetchMock as any)
    render(<ElementRow row={unstamped} expanded displayId="d1" onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.getByText(/couldn.t save the stamp/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^stamp$/i }))
    await waitFor(() => expect(screen.queryByText(/couldn.t save the stamp/i)).not.toBeInTheDocument())
  })
})
