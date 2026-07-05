import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BulletinComposer } from './BulletinComposer'

describe('BulletinComposer', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ id: 'p1' }) })) as unknown as typeof fetch)
  })

  it('includes isPublic:true in the POST body when "Share to Trending" is toggled on', async () => {
    render(<BulletinComposer onPosted={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share something/i }))
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), { target: { value: 'hello' } })
    fireEvent.click(screen.getByLabelText(/share to trending/i))
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/bulletin', expect.anything()))
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === '/api/bulletin')!
    expect(JSON.parse(call[1].body)).toMatchObject({ text: 'hello', isPublic: true })
  })

  it('defaults isPublic to false', async () => {
    render(<BulletinComposer onPosted={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share something/i }))
    fireEvent.change(screen.getByPlaceholderText(/what's on your mind/i), { target: { value: 'hi' } })
    fireEvent.click(screen.getByRole('button', { name: /^post$/i }))
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/bulletin', expect.anything()))
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] === '/api/bulletin')!
    expect(JSON.parse(call[1].body).isPublic).toBe(false)
  })
})
