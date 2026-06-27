import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { rateLimit } from '@/lib/rate-limit'
import { SYSTEM_PROMPT } from '@/lib/ai/system-prompt'
import { extractJSON, validateGeneratedPage } from '@/lib/ai/validate'

export async function POST(request: NextRequest) {
  // 1. Auth
  const user = await getUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Rate limit — 5 generations per minute
  const rateLimited = await rateLimit(request, {
    limit: 5,
    windowMs: 60_000,
    prefix: 'ai-generate',
  })
  if (rateLimited) return rateLimited

  // 3. Parse input
  let prompt: string
  let vibe: string
  try {
    const body = await request.json()
    prompt = body.prompt
    vibe = body.vibe || 'professional'
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 5) {
    return NextResponse.json(
      { error: 'Prompt must be at least 5 characters' },
      { status: 400 }
    )
  }

  if (prompt.length > 1000) {
    return NextResponse.json(
      { error: 'Prompt must be under 1000 characters' },
      { status: 400 }
    )
  }

  // 4. Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'AI generation is not configured. Set ANTHROPIC_API_KEY.' },
      { status: 500 }
    )
  }

  try {
    // 5. Call Anthropic API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      temperature: 0.7,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Create a page for: ${prompt.trim()}\n\nVibe: ${vibe}`,
        },
      ],
    })

    // 6. Extract and parse JSON
    const rawText = message.content[0].type === 'text' ? message.content[0].text : ''
    if (!rawText) {
      return NextResponse.json(
        { error: 'AI returned empty response. Please try again.' },
        { status: 502 }
      )
    }

    const jsonStr = extractJSON(rawText)
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI JSON:', jsonStr.slice(0, 500))
      return NextResponse.json(
        { error: 'AI response was not valid JSON. Please try again.' },
        { status: 422 }
      )
    }

    // 7. Validate structure
    let page
    try {
      page = validateGeneratedPage(parsed)
    } catch (err: any) {
      console.error('Validation error:', err.message)
      return NextResponse.json(
        { error: `Invalid page structure: ${err.message}. Please try again.` },
        { status: 422 }
      )
    }

    // 8. Create Display — auto-published
    let slug = slugify(page.title)
    if (!slug) slug = 'generated-page'
    let counter = 1
    const maxSlugAttempts = 10

    while (counter <= maxSlugAttempts) {
      const existing = await db.display.findUnique({
        where: { userId_slug: { userId: user.id, slug } },
      })
      if (!existing) break
      slug = `${slugify(page.title)}-${counter}`
      counter++
    }

    const display = await db.display.create({
      data: {
        title: page.title,
        slug,
        description: page.description || null,
        userId: user.id,
        published: true,
        sections: page.sections as any,
        ...(page.tabs && { tabs: page.tabs as any }),
        ...(page.headerCard && { headerCard: page.headerCard as any }),
        ...(page.background && { background: page.background as any }),
      },
    })

    // 9. Create share link
    let shareCode = slugify(page.title).slice(0, 30) || 'page'
    let codeCounter = 1
    const maxCodeAttempts = 10

    while (codeCounter <= maxCodeAttempts) {
      const existing = await db.shareLink.findUnique({
        where: { code: shareCode },
      })
      if (!existing) break
      shareCode = `${slugify(page.title).slice(0, 25)}-${codeCounter}`
      codeCounter++
    }

    const shareLink = await db.shareLink.create({
      data: {
        code: shareCode,
        displayId: display.id,
        label: 'AI Generated',
      },
    })

    // 10. Return result
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      url: `${appUrl}/s/${shareLink.code}`,
      editUrl: `/editor?id=${display.id}`,
      displayId: display.id,
      shareCode: shareLink.code,
      title: page.title,
    })
  } catch (err: any) {
    console.error('Generate error:', err)

    // Handle Anthropic API errors specifically
    if (err?.status === 429) {
      return NextResponse.json(
        { error: 'AI service is busy. Please wait a moment and try again.' },
        { status: 429 }
      )
    }

    if (err?.status >= 500) {
      return NextResponse.json(
        { error: 'AI service is temporarily unavailable. Please try again.' },
        { status: 502 }
      )
    }

    return NextResponse.json(
      { error: 'Something went wrong generating your page. Please try again.' },
      { status: 500 }
    )
  }
}
