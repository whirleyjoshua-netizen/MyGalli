import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { Section, CanvasElement } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'
import { collectRsvpGuests, summarizeRsvp, buildItemBoard } from '@/lib/rsvp'

// GET /api/displays/[id]/rsvp?elementId=xxx — public RSVP board.
// Returns roster + item board ONLY when the owner enabled rsvpPublicList on that
// element and the page is published. Private RSVPs return { public: false } and
// never leak collected data — that surfaces only in the owner's analytics.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const elementId = request.nextUrl.searchParams.get('elementId')
    if (!elementId) {
      return NextResponse.json({ error: 'elementId required' }, { status: 400 })
    }

    const display = await db.display.findUnique({
      where: { id },
      select: { published: true, sections: true, tabs: true },
    })

    if (!display || !display.published) {
      return NextResponse.json({ public: false })
    }

    const sections: Section[] =
      typeof display.sections === 'string' ? JSON.parse(display.sections) : (display.sections as unknown as Section[]) || []
    const tabsConfig: TabsConfig | null = display.tabs
      ? (typeof display.tabs === 'string' ? JSON.parse(display.tabs) : (display.tabs as unknown as TabsConfig))
      : null

    const element = findElement(elementId, sections, tabsConfig)
    if (!element || element.type !== 'rsvp' || !element.rsvpPublicList) {
      return NextResponse.json({ public: false })
    }

    const responses = await db.formResponse.findMany({ where: { displayId: id } })
    const guests = collectRsvpGuests(elementId, responses)
    const { going, maybe, cant, counts } = summarizeRsvp(guests)
    const board = buildItemBoard(element.rsvpItems || [], guests)

    // Strip notes from the public payload — those stay owner-only.
    const strip = (list: typeof going) => list.map((g) => ({ name: g.name, guests: g.guests, items: g.items }))

    return NextResponse.json({
      public: true,
      counts,
      going: strip(going),
      maybe: strip(maybe),
      cant: strip(cant),
      items: board,
    })
  } catch (error) {
    console.error('Error fetching RSVP board:', error)
    return NextResponse.json({ error: 'Failed to fetch RSVP board' }, { status: 500 })
  }
}

function findElement(elementId: string, sections: Section[], tabs: TabsConfig | null): CanvasElement | null {
  const scan = (secs: Section[]): CanvasElement | null => {
    for (const section of secs || []) {
      for (const column of section.columns || []) {
        for (const el of column.elements || []) {
          if (el.id === elementId) return el
        }
      }
    }
    return null
  }
  const inMain = scan(sections)
  if (inMain) return inMain
  for (const tab of tabs?.tabs || []) {
    const found = scan(tab.sections || [])
    if (found) return found
  }
  return null
}
