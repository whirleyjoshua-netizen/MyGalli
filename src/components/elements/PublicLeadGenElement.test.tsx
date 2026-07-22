import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PublicLeadGenElement } from './PublicLeadGenElement'
import type { CanvasElement } from '@/lib/types/canvas'

vi.mock('@/lib/analytics', () => ({ trackInteraction: vi.fn().mockResolvedValue(undefined) }))

function el(over: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'lg1',
    type: 'lead-gen',
    leadGenHeadline: 'Get my guide',
    leadGenButtonLabel: 'Send it',
    leadGenSuccessText: 'Check your inbox!',
    ...over,
  } as CanvasElement
}

const fetchMock = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, fileUrl: 'https://blob/x.pdf', fileName: 'guide.pdf' }),
  })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock())
})
afterEach(() => vi.unstubAllGlobals())

const calls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls

describe('PublicLeadGenElement', () => {
  it('renders the headline and an email field but no name field by default', () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    expect(screen.getByText('Get my guide')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
    expect(screen.queryByLabelText('Name')).toBeNull()
  })

  it('shows the name field when leadGenCollectName is set', () => {
    render(<PublicLeadGenElement element={el({ leadGenCollectName: true })} displayId="d1" />)
    expect(screen.getByLabelText('Name')).toBeTruthy()
  })

  it('submits the email and shows the success text + download link', async () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    await waitFor(() => expect(screen.getByText('Check your inbox!')).toBeTruthy())
    const link = screen.getByRole('link', { name: /guide\.pdf|download/i }) as HTMLAnchorElement
    expect(link.href).toContain('https://blob/x.pdf')
    const call = calls().find((c) => String(c[0]).includes('/api/lead-gen/d1'))
    expect(JSON.parse(call![1].body)).toMatchObject({ elementId: 'lg1', email: 'a@b.com' })
  })

  it('omits the download link when the payload has no file', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) })
    )
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    await waitFor(() => expect(screen.getByText('Check your inbox!')).toBeTruthy())
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('does not submit a malformed email', () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    expect(calls().some((c) => String(c[0]).includes('/api/lead-gen'))).toBe(false)
  })

  it('does not submit an empty email', () => {
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    expect(calls().some((c) => String(c[0]).includes('/api/lead-gen'))).toBe(false)
  })

  it('surfaces an error when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }))
    render(<PublicLeadGenElement element={el()} displayId="d1" />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send it/i }))
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeTruthy())
  })
})
