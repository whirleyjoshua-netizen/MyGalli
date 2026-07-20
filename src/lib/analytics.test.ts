import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackInteraction, trackShare, trackPageView } from './analytics'

function lastBody(fetchMock: ReturnType<typeof vi.fn>) {
  const call = fetchMock.mock.calls.at(-1)
  return JSON.parse(call![1].body as string)
}

describe('trackInteraction / trackShare', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts an interact event with typed metadata', async () => {
    await trackInteraction('disp_1', 'el_1', 'poll', 'vote')
    expect(fetchMock).toHaveBeenCalledWith('/api/analytics/track', expect.anything())
    expect(lastBody(fetchMock)).toMatchObject({
      displayId: 'disp_1',
      eventType: 'interact',
      metadata: { elementId: 'el_1', elementType: 'poll', action: 'vote' },
    })
  })

  it('posts a share event carrying the channel', async () => {
    await trackShare('disp_1', 'twitter')
    expect(lastBody(fetchMock)).toMatchObject({
      displayId: 'disp_1',
      eventType: 'share',
      metadata: { channel: 'twitter' },
    })
  })

  it('never throws when the network fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(trackInteraction('disp_1', 'el_1', 'poll', 'vote')).resolves.toBeUndefined()
    await expect(trackShare('disp_1', 'copy')).resolves.toBeUndefined()
  })

  it('does nothing when displayId is empty', async () => {
    await trackInteraction('', 'el_1', 'poll', 'vote')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('visitor id', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function bodyOf(call: number) {
    return JSON.parse(fetchMock.mock.calls[call][1].body as string)
  }

  it('sends a visitorId with a page view', async () => {
    await trackPageView('disp_1')
    expect(bodyOf(0).visitorId).toMatch(/^vis_/)
  })

  it('reuses the same visitorId across separate events', async () => {
    await trackPageView('disp_1')
    await trackInteraction('disp_1', 'el_1', 'poll', 'vote')
    expect(bodyOf(1).visitorId).toBe(bodyOf(0).visitorId)
  })

  it('persists the visitorId in localStorage so it survives a new session', async () => {
    await trackPageView('disp_1')
    const stored = localStorage.getItem('galli_visitor_id')
    expect(stored).toBe(bodyOf(0).visitorId)

    // A new tab clears sessionStorage but not localStorage.
    sessionStorage.clear()
    await trackPageView('disp_1')
    expect(bodyOf(1).visitorId).toBe(stored)
    expect(bodyOf(1).sessionId).not.toBe(bodyOf(0).sessionId)
  })

  it('still sends the event when localStorage throws', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    await trackPageView('disp_1')
    expect(fetchMock).toHaveBeenCalled()
    spy.mockRestore()
  })
})
