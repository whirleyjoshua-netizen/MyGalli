import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { trackInteraction, trackShare } from './analytics'

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
