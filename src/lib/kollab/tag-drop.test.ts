import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create } },
}))

import { tagDropAsset } from './tag-drop'

const OWN = 'https://abc123.public.blob.vercel-storage.com/hub-drops/h1/y.jpg'
const FOREIGN = 'https://abc123.public.blob.vercel-storage.com/avatars/u1/y.jpg'
const good = { tags: ['soccer', 'crowd'], desc: 'Wide shot of a pitch', subjects: 8, quality: 0.8 }
const asText = (o: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(o) }] })

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  create.mockResolvedValue(asText(good))
})

describe('tagDropAsset', () => {
  it('returns normalised tags on success', async () => {
    const r = await tagDropAsset('h1', OWN)
    expect(r?.tags).toEqual(['soccer', 'crowd'])
    expect(r?.desc).toBe('Wide shot of a pitch')
    expect(r?.subjects).toBe(8)
    expect(r?.quality).toBe(0.8)
    expect(r?.model).toBe('claude-haiku-4-5')
    expect(typeof r?.at).toBe('string')
  })

  it('uses Haiku and sends the url as an image block', async () => {
    await tagDropAsset('h1', OWN)
    const arg = create.mock.calls[0][0]
    expect(arg.model).toBe('claude-haiku-4-5')
    const img = arg.messages[0].content.find((b: any) => b.type === 'image')
    expect(img.source).toEqual({ type: 'url', url: OWN })
  })

  it('constrains the output with a json schema', async () => {
    await tagDropAsset('h1', OWN)
    expect(create.mock.calls[0][0].output_config.format.type).toBe('json_schema')
  })

  it('refuses a url that is not this hub\'s drop asset, without calling the API', async () => {
    expect(await tagDropAsset('h1', FOREIGN)).toBe(null)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns null when the API key is unset, without calling the API', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(await tagDropAsset('h1', OWN)).toBe(null)
    expect(create).not.toHaveBeenCalled()
  })

  it('returns null instead of throwing when the API errors', async () => {
    create.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }))
    await expect(tagDropAsset('h1', OWN)).resolves.toBe(null)
  })

  it('returns null on unparseable output', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'not json' }] })
    expect(await tagDropAsset('h1', OWN)).toBe(null)
  })

  it('returns null when there is no text block', async () => {
    create.mockResolvedValue({ content: [] })
    expect(await tagDropAsset('h1', OWN)).toBe(null)
  })

  it('coerces junk field types rather than trusting them', async () => {
    create.mockResolvedValue(asText({ tags: ['ok', 42, null], desc: 99, subjects: 'many', quality: 5 }))
    const r = await tagDropAsset('h1', OWN)
    expect(r?.tags).toEqual(['ok'])
    expect(r?.desc).toBe('')
    expect(r?.subjects).toBe(0)
    expect(r?.quality).toBe(1)
  })

  it('caps tags at 12', async () => {
    create.mockResolvedValue(asText({ ...good, tags: Array.from({ length: 30 }, (_, i) => `t${i}`) }))
    expect((await tagDropAsset('h1', OWN))?.tags).toHaveLength(12)
  })
})
