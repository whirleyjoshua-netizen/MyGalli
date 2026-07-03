// Shared, pure element-response aggregators. Used by both the page analytics
// route (anonymous FormResponse rows) and the bulletin surface (identified
// BulletinResponse rows). No IO — unit-testable. When a record carries an
// `identity`, it is added to the aggregate's `respondents` roster.
import type { CanvasElement } from '@/lib/types/canvas'

export interface Respondent {
  userId: string
  name: string
  avatar?: string | null
}

export interface RespondentAnswer {
  user: Respondent
  answer: unknown
}

export interface ResponseRecord {
  responses: unknown // { [elementId]: { type, question?, answer } }
  submittedAt?: Date | string | null
  identity?: Respondent
}

export interface PollAggregate {
  elementId: string
  type: 'poll'
  question: string
  options: string[]
  allowMultiple: boolean
  totalVoters: number
  distribution: { option: string; count: number; percentage: number }[]
  respondents: RespondentAnswer[]
}

export interface RatingAggregate {
  elementId: string
  type: 'rating'
  question: string
  ratingMax: number
  ratingStyle: 'stars' | 'numeric'
  responseCount: number
  average: number
  distribution: { value: number; count: number }[]
  respondents: RespondentAnswer[]
}

export interface ShortAnswerAggregate {
  elementId: string
  type: 'shortanswer'
  question: string
  responseCount: number
  recentAnswers: { answer: string; submittedAt: string }[]
  respondents: RespondentAnswer[]
}

export type ElementAggregate = PollAggregate | RatingAggregate | ShortAnswerAggregate

function entryFor(record: ResponseRecord, elementId: string): { type?: string; answer?: unknown } | null {
  const data = record.responses as Record<string, { type?: string; answer?: unknown }> | null
  return data?.[elementId] ?? null
}

function toIso(v: Date | string | null | undefined): string {
  if (v instanceof Date) return v.toISOString()
  return (v as string) || ''
}

export function aggregatePoll(config: CanvasElement, records: ResponseRecord[]): PollAggregate {
  const options = config.pollOptions || []
  const distribution: Record<string, number> = {}
  for (const o of options) distribution[o] = 0
  const respondents: RespondentAnswer[] = []
  let totalVoters = 0

  for (const rec of records) {
    const entry = entryFor(rec, config.id)
    if (!entry || entry.type !== 'poll') continue
    totalVoters++
    const selections = Array.isArray(entry.answer) ? (entry.answer as string[]) : [entry.answer as string]
    for (const s of selections) distribution[s] = (distribution[s] || 0) + 1
    if (rec.identity) respondents.push({ user: rec.identity, answer: selections })
  }

  return {
    elementId: config.id,
    type: 'poll',
    question: config.pollQuestion || 'What do you think?',
    options,
    allowMultiple: config.pollAllowMultiple || false,
    totalVoters,
    distribution: Object.entries(distribution).map(([option, count]) => ({
      option,
      count,
      percentage: totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0,
    })),
    respondents,
  }
}

export function aggregateRating(config: CanvasElement, records: ResponseRecord[]): RatingAggregate {
  const max = config.ratingMax || 5
  const distribution: Record<number, number> = {}
  for (let i = 1; i <= max; i++) distribution[i] = 0
  const respondents: RespondentAnswer[] = []
  let responseCount = 0
  let sum = 0

  for (const rec of records) {
    const entry = entryFor(rec, config.id)
    if (!entry || entry.type !== 'rating') continue
    const value = Number(entry.answer)
    if (!(value >= 1 && value <= max)) continue
    responseCount++
    sum += value
    distribution[value]++
    if (rec.identity) respondents.push({ user: rec.identity, answer: value })
  }

  return {
    elementId: config.id,
    type: 'rating',
    question: config.ratingQuestion || 'Untitled Rating',
    ratingMax: max,
    ratingStyle: config.ratingStyle || 'stars',
    responseCount,
    average: responseCount > 0 ? Math.round((sum / responseCount) * 10) / 10 : 0,
    distribution: Object.entries(distribution)
      .map(([value, count]) => ({ value: Number(value), count }))
      .sort((a, b) => b.value - a.value),
    respondents,
  }
}

export function aggregateShortAnswer(config: CanvasElement, records: ResponseRecord[]): ShortAnswerAggregate {
  const recentAnswers: { answer: string; submittedAt: string }[] = []
  const respondents: RespondentAnswer[] = []

  for (const rec of records) {
    const entry = entryFor(rec, config.id)
    if (!entry || entry.type !== 'shortanswer' || !entry.answer) continue
    const answer = String(entry.answer)
    recentAnswers.push({ answer, submittedAt: toIso(rec.submittedAt) })
    if (rec.identity) respondents.push({ user: rec.identity, answer })
  }

  return {
    elementId: config.id,
    type: 'shortanswer',
    question: config.shortAnswerQuestion || 'Untitled Question',
    responseCount: recentAnswers.length,
    recentAnswers: recentAnswers.slice(0, 50),
    respondents,
  }
}

export function aggregateBlock(config: CanvasElement, records: ResponseRecord[]): ElementAggregate | null {
  switch (config.type) {
    case 'poll':
      return aggregatePoll(config, records)
    case 'rating':
      return aggregateRating(config, records)
    case 'shortanswer':
      return aggregateShortAnswer(config, records)
    default:
      return null
  }
}

// Prisma BulletinResponse rows (with the responder selected) → identified
// ResponseRecords. Shared by the feed, respond, and analytics routes so the
// mapping lives in exactly one place.
export interface BulletinResponseRow {
  userId: string
  responses: unknown
  createdAt: Date | string
  user: { name: string | null; username: string; avatar: string | null }
}

export function toRecords(rows: BulletinResponseRow[]): ResponseRecord[] {
  return rows.map((r) => ({
    responses: r.responses,
    submittedAt: r.createdAt,
    identity: { userId: r.userId, name: r.user.name ?? r.user.username, avatar: r.user.avatar },
  }))
}
