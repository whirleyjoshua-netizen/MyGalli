import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { KIT_REGISTRY } from '@/lib/kits/registry'
import { generateKitDisplay } from '@/lib/kits/generate'
import '@/lib/kits/all'
import { TEMPLATE_REGISTRY } from '@/lib/templates/registry'
import { isPro } from '@/lib/plan'
import { createElement, createSection } from '@/lib/types/canvas'

// GET /api/displays - List user's displays
export async function GET(request: NextRequest) {
  const user = await getUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const displays = await db.display.findMany({
    where: { userId: user.id, kind: { not: 'profile' } },
    orderBy: { updatedAt: 'desc' },
  })

  // Calculate element count from sections (and tabs if present)
  const displaysWithCounts = displays.map((display) => {
    let elementCount = 0

    const countSections = (secs: any[]) => {
      for (const section of secs) {
        for (const column of section.columns || []) {
          elementCount += (column.elements || []).length
        }
      }
    }

    // Count from tabs if present
    const tabsData = display.tabs
      ? (typeof display.tabs === 'string' ? JSON.parse(display.tabs as string) : display.tabs)
      : null

    if (tabsData?.enabled && tabsData.tabs) {
      for (const tab of tabsData.tabs) {
        countSections(tab.sections || [])
      }
    } else {
      const sections = typeof display.sections === 'string'
        ? JSON.parse(display.sections)
        : display.sections || []
      countSections(sections)
    }

    return {
      ...display,
      _count: { elements: elementCount },
    }
  })

  return NextResponse.json(displaysWithCounts)
}

// POST /api/displays - Create a new display
export async function POST(request: NextRequest) {
  const user = await getUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { title, description, kitId, templateId, kind } = await request.json()

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    // Boards are a Pro-only Display kind, seeded with a single gallery element.
    // if (kind === 'collection' && !isPro(user)) {
    //   return NextResponse.json({ error: 'Pro required' }, { status: 403 })
    // }

    // Generate unique slug
    let slug = slugify(title)
    let counter = 1

    while (true) {
      const existing = await db.display.findUnique({
        where: {
          userId_slug: { userId: user.id, slug },
        },
      })
      if (!existing) break
      slug = `${slugify(title)}-${counter}`
      counter++
    }

    // Seed from a kit or a template; Pro items require a Pro plan.
    let kitData: any = {}
    if (kitId) {
      const kit = KIT_REGISTRY[kitId]
      if (!kit) {
        return NextResponse.json({ error: 'Unknown kit' }, { status: 400 })
      }
      if (kit.pro && !isPro(user)) {
        return NextResponse.json({ error: 'Pro required' }, { status: 403 })
      }
      const generated = generateKitDisplay(kit, user.name || user.username)
      kitData = {
        sections: generated.sections,
        tabs: generated.tabs,
        headerCard: generated.headerCard,
        kitConfig: generated.kitConfig,
      }
    } else if (templateId) {
      const template = TEMPLATE_REGISTRY[templateId]
      if (!template) {
        return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
      }
      if (template.pro && !isPro(user)) {
        return NextResponse.json({ error: 'Pro required' }, { status: 403 })
      }
      // WARNING: template/kit seeds reuse deterministic element ids. Do NOT include a
      // 'live-feed' element in any seed until element ids are regenerated on
      // instantiation — LiveFeed rows are keyed by element id (a global PK), so a
      // shared seed id would make two owners' feeds collide. See live-feed design spec.
      kitData = {
        sections: template.seed.sections,
        tabs: template.seed.tabs,
        headerCard: template.seed.headerCard,
      }
    }

    const display = await db.display.create({
      data: {
        title,
        slug,
        description,
        userId: user.id,
        ...(kind === 'collection' ? { kind: 'collection' } : {}),
        sections:
          kind === 'collection'
            ? [(() => { const s = createSection('full-width'); s.columns[0].elements = [createElement('collection-view')]; return s })()]
            : kitData.sections || [],
        ...(kitData.tabs && { tabs: kitData.tabs }),
        ...(kitData.headerCard && { headerCard: kitData.headerCard }),
        ...(kitData.kitConfig && { kitConfig: kitData.kitConfig }),
      },
    })

    return NextResponse.json(display, { status: 201 })
  } catch (error) {
    console.error('Create display error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
