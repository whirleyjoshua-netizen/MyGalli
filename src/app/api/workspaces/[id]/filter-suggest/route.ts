import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { authorizeWorkspace } from '@/lib/workspaces/authorize'
import { validateFilter, describeFilter, FilterError, type FilterField } from '@/lib/workspaces/filter'
import { buildFilterJsonSchema, describeSchemaForPrompt } from '@/lib/workspaces/filter-schema'

const SYSTEM = `You translate a plain-English request into a filter over a table.

You are given ONLY the table's column schema — never its rows. Return a filter
that selects the rows the user described.

Rules:
- Use only the column keys listed. Never invent a column.
- Use only the comparators each column lists.
- For choice columns the value must be exactly one of that column's options.
- Strip currency symbols and separators from numbers: "$1,200" -> 1200.
- Date values MUST be in "YYYY-MM-DD" form (e.g. "2026-07-01"). Never use "MM/DD/YYYY" or any other format.
- The filter is flat: one top-level "and"/"or" over conditions. There is no nesting.
- If the request maps to a single condition, still return the {op, conditions} shape.`

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'ws-filter-ai', identifier: user.id })
  if (limited) return limited

  const { id: workspaceId } = await params

  let question: string
  try {
    question = (await request.json()).question
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return NextResponse.json({ error: 'Describe what you want to see (at least 3 characters)' }, { status: 400 })
  }
  if (question.length > 500) {
    return NextResponse.json({ error: 'Description must be under 500 characters' }, { status: 400 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI filtering is not configured. Set ANTHROPIC_API_KEY.' },
      { status: 500 }
    )
  }

  try {
    await authorizeWorkspace(user.id, workspaceId)

    const fields = (await db.workspaceField.findMany({
      where: { workspaceId },
      orderBy: { position: 'asc' },
    })) as unknown as FilterField[]

    if (fields.length === 0) {
      return NextResponse.json({ error: 'Add a column before filtering' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    // Schema only. Record values never enter this request.
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM,
      output_config: {
        format: { type: 'json_schema', schema: buildFilterJsonSchema(fields) },
      },
      messages: [
        {
          role: 'user',
          content: `Columns:\n${describeSchemaForPrompt(fields)}\n\nRequest: ${question.trim()}`,
        },
      ],
    })

    const raw = message.content[0]?.type === 'text' ? message.content[0].text : ''
    if (!raw) {
      return NextResponse.json({ error: 'The model returned nothing. Try rephrasing.' }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'The model did not return a valid filter. Try rephrasing.' }, { status: 422 })
    }

    // The model is untrusted input. This is the boundary.
    const filter = validateFilter(parsed, fields)

    return NextResponse.json({ filter, summary: describeFilter(filter, fields) })
  } catch (error: any) {
    if (error instanceof FilterError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    if (error.message === 'Unauthorized or Workspace not found') {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    if (error?.status === 429) {
      return NextResponse.json({ error: 'AI service is busy. Please wait a moment.' }, { status: 429 })
    }
    if (error?.status >= 500) {
      return NextResponse.json({ error: 'AI service is temporarily unavailable.' }, { status: 502 })
    }
    console.error('Filter suggest error:', error)
    return NextResponse.json({ error: 'Could not build that filter. Try rephrasing.' }, { status: 500 })
  }
}
