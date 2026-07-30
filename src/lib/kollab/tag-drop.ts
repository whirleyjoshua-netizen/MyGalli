import Anthropic from '@anthropic-ai/sdk'
import { isOwnDropAsset } from '@/lib/hub-drops'

export type DropTags = {
  tags: string[]
  desc: string
  subjects: number
  quality: number
  model: string
  at: string
}

const MODEL = 'claude-haiku-4-5'

const SYSTEM = `You label a single photo or video still for a community media pool.

Return:
- tags: up to 8 short lowercase keywords for what is visibly present (subjects, setting, activity, mood).
- desc: one plain sentence describing the shot, under 120 characters.
- subjects: how many people are clearly visible. 0 if none.
- quality: 0 to 1, how usable this frame is in a highlight reel. Judge framing,
  focus, exposure and motion blur only. Do not judge the people in it.

Describe only what you can see. Never guess names, locations, or events.`

const TAG_SCHEMA = {
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' } },
    desc: { type: 'string' },
    subjects: { type: 'integer' },
    quality: { type: 'number' },
  },
  required: ['tags', 'desc', 'subjects', 'quality'],
  additionalProperties: false,
} as const

const clamp = (n: unknown, lo: number, hi: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(Math.max(n, lo), hi) : lo

/**
 * Best-effort. Returns null on every failure path and never throws, because the
 * only caller is an approval write that must succeed whether or not tagging does.
 * A null-tagged drop is still stitchable on its metadata alone.
 */
export async function tagDropAsset(hubId: string, url: string): Promise<DropTags | null> {
  // The vision call fetches this URL server-side. Restricting it to this hub's
  // own drop namespace keeps the request from being pointed at anything else.
  if (!isOwnDropAsset(hubId, url)) return null
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: TAG_SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url } },
            { type: 'text', text: 'Label this frame.' },
          ],
        },
      ],
    })

    const text = message.content.find((b) => b?.type === 'text')?.text as string | undefined
    if (!text) return null

    const parsed = JSON.parse(text) as Record<string, unknown>
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string' && !!t.trim()).map((t) => t.trim().toLowerCase().slice(0, 32)).slice(0, 12)
      : []

    return {
      tags,
      desc: typeof parsed.desc === 'string' ? parsed.desc.trim().slice(0, 200) : '',
      subjects: Math.round(clamp(parsed.subjects, 0, 999)),
      quality: clamp(parsed.quality, 0, 1),
      model: MODEL,
      at: new Date().toISOString(),
    }
  } catch (error) {
    console.warn('kollab tag-drop: tagging failed, continuing without tags', error)
    return null
  }
}
