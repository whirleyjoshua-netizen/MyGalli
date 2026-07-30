import { describe, it, expect, vi, beforeEach } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create } } }))

import { directReel, DirectorError } from './director'

const input = { digest: 'd1 | video | 4s | @maria | today', preset: 'recent', prompt: null, targetSec: 30 }
const edl = { title: 'Saturday', clips: [{ dropId: 'd1', in: 0, out: 3 }] }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ANTHROPIC_API_KEY = 'test-key'
  create.mockResolvedValue({ content: [{ type: 'text', text: JSON.stringify(edl) }] })
})

describe('directReel', () => {
  it('returns the parsed JSON', async () => {
    expect(await directReel(input)).toEqual(edl)
  })

  it('uses Opus 4.8 with adaptive thinking and a json schema', async () => {
    await directReel(input)
    const arg = create.mock.calls[0][0]
    expect(arg.model).toBe('claude-opus-4-8')
    expect(arg.thinking).toEqual({ type: 'adaptive' })
    expect(arg.output_config.format.type).toBe('json_schema')
    expect(arg.output_config.effort).toBe('medium')
  })

  it('finds the text block even when a thinking block comes first', async () => {
    create.mockResolvedValue({
      content: [{ type: 'thinking', thinking: 'hmm' }, { type: 'text', text: JSON.stringify(edl) }],
    })
    expect(await directReel(input)).toEqual(edl)
  })

  it('puts the digest and the target length in the prompt', async () => {
    await directReel({ ...input, targetSec: 45 })
    const text = create.mock.calls[0][0].messages[0].content
    expect(text).toContain('d1 | video')
    expect(text).toContain('45')
  })

  it('passes a free-text prompt through', async () => {
    await directReel({ ...input, prompt: 'the goals and the crowd' })
    expect(create.mock.calls[0][0].messages[0].content).toContain('the goals and the crowd')
  })

  it('throws a 500 DirectorError when the key is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY
    await expect(directReel(input)).rejects.toMatchObject({ status: 500 })
    expect(create).not.toHaveBeenCalled()
  })

  it('maps a 429 to a 429 DirectorError', async () => {
    create.mockRejectedValue(Object.assign(new Error('busy'), { status: 429 }))
    await expect(directReel(input)).rejects.toMatchObject({ status: 429 })
  })

  it('maps a 5xx to a 502 DirectorError', async () => {
    create.mockRejectedValue(Object.assign(new Error('down'), { status: 503 }))
    await expect(directReel(input)).rejects.toMatchObject({ status: 502 })
  })

  it('maps a 401 to a 500 DirectorError', async () => {
    create.mockRejectedValue(Object.assign(new Error('nope'), { status: 401 }))
    await expect(directReel(input)).rejects.toMatchObject({ status: 500 })
  })

  it('throws a 502 when there is no text block', async () => {
    create.mockResolvedValue({ content: [{ type: 'thinking', thinking: 'only' }] })
    await expect(directReel(input)).rejects.toMatchObject({ status: 502 })
  })

  it('throws a 422 on unparseable JSON', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: '{oops' }] })
    await expect(directReel(input)).rejects.toMatchObject({ status: 422 })
  })

  it('DirectorError is an Error', async () => {
    expect(new DirectorError('x', 500)).toBeInstanceOf(Error)
  })
})
