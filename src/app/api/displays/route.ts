import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { slugify } from '@/lib/utils'
import { KIT_REGISTRY } from '@/lib/kits/registry'
import { generateKitDisplay } from '@/lib/kits/generate'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'
import '@/lib/kits/wedding-kit'
import '@/lib/kits/creator-kit'
import '@/lib/kits/creative-kit'
import '@/lib/kits/academic-kit'
import '@/lib/kits/business-kit'

// GET /api/displays - List user's displays
export async function GET(request: NextRequest) {
  const user = await getUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const displays = await db.display.findMany({
    where: { userId: user.id },
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
    const { title, description, kitId } = await request.json()

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

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

    // If kitId is provided, generate kit structure
    let kitData: any = {}
    if (kitId) {
      const kit = KIT_REGISTRY[kitId]
      if (!kit) {
        return NextResponse.json({ error: 'Unknown kit' }, { status: 400 })
      }
      const generated = generateKitDisplay(kit, user.name || user.username)
      kitData = {
        sections: generated.sections,
        tabs: generated.tabs,
        headerCard: generated.headerCard,
        kitConfig: generated.kitConfig,
      }
    }

    const display = await db.display.create({
      data: {
        title,
        slug,
        description,
        userId: user.id,
        sections: kitData.sections || [],
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
