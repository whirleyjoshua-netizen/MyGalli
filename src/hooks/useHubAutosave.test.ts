import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useHubAutosave } from './useHubAutosave'

beforeEach(() => { vi.useFakeTimers(); (global as any).fetch = vi.fn() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const ok = (version: number) => ({ ok: true, status: 200, json: async () => ({ version }) })

describe('useHubAutosave', () => {
  it('debounced-PATCHes the payload with version and records lastSaved', async () => {
    ;(fetch as any).mockResolvedValue(ok(6))
    const { rerender } = renderHook(({ p }) => useHubAutosave({ hubId: 'h1', payload: p, version: 5, enabled: true }), { initialProps: { p: { a: 1 } } })
    rerender({ p: { a: 2 } })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(fetch).toHaveBeenCalledWith('/api/hubs/h1', expect.objectContaining({ method: 'PATCH' }))
    const body = JSON.parse((fetch as any).mock.calls[0][1].body)
    expect(body.version).toBe(5)
    expect(body.a).toBe(2)
  })
  it('sets conflict on 409', async () => {
    ;(fetch as any).mockResolvedValue({ ok: false, status: 409, json: async () => ({ version: 9 }) })
    const { result, rerender } = renderHook(({ p }) => useHubAutosave({ hubId: 'h1', payload: p, version: 5, enabled: true }), { initialProps: { p: { a: 1 } } })
    rerender({ p: { a: 2 } })
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(result.current.conflict).toBe(true)
  })
})
