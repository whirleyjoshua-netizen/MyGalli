import type { CanvasElement, Section } from '@/lib/types/canvas'

export interface TemplateConfig {
  id: string
  name: string
  description: string
  category: string
  emoji: string
  gradient: string
  pro?: boolean
  seed: {
    sections: Section[]
    headerCard?: unknown
    tabs?: unknown
  }
}

// Authoring helpers — deterministic ids so seeds are stable/testable.
let _n = 0
function el(e: Partial<CanvasElement> & { type: CanvasElement['type'] }): CanvasElement {
  _n += 1
  return { id: `tpl-el-${_n}`, ...e } as CanvasElement
}
function sec(elements: CanvasElement[]): Section {
  _n += 1
  return { id: `tpl-sec-${_n}`, layout: 'full-width', columns: [{ id: `tpl-col-${_n}`, elements }] }
}
const btn = (text: string) =>
  el({ type: 'button', buttonText: text, buttonUrl: '', buttonVariant: 'solid', buttonColor: 'blue', buttonAlign: 'center' })

export const TEMPLATE_REGISTRY: Record<string, TemplateConfig> = {
  'link-in-bio': {
    id: 'link-in-bio',
    name: 'Link-in-Bio',
    description: 'A clean profile with a stack of links — perfect for your social bio.',
    category: 'personal',
    emoji: '🔗',
    gradient: 'from-galli/30 to-galli-aqua/20',
    seed: {
      sections: [
        sec([
          el({ type: 'image', url: '', alt: 'Your photo', caption: '' }),
          el({ type: 'heading', content: 'Your Name', level: 1 }),
          el({ type: 'text', content: 'A short bio about you and what you make.' }),
        ]),
        sec([btn('My Website'), btn('Latest Project'), btn('Contact Me')]),
      ],
    },
  },
  'travel-itinerary': {
    id: 'travel-itinerary',
    name: 'Travel Itinerary',
    description: 'Plan and share a trip day by day, with a photo gallery.',
    category: 'personal',
    emoji: '🗺️',
    gradient: 'from-galli-aqua/30 to-galli/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: 'Trip Itinerary', level: 1 }),
          el({ type: 'text', content: 'Where we are going and why it will be unforgettable.' }),
        ]),
        sec([
          el({ type: 'heading', content: 'Day by Day', level: 2 }),
          el({ type: 'list', listType: 'numbered', listTitle: 'Plan', listColumns: 1, items: ['Day 1 — Arrive & explore', 'Day 2 — Main adventure', 'Day 3 — Relax & depart'] }),
        ]),
        sec([
          el({ type: 'heading', content: 'Gallery', level: 2 }),
          el({ type: 'image', url: '', alt: 'Trip photo', caption: 'Add your favourite shots here.' }),
        ]),
      ],
    },
  },
  'reading-list': {
    id: 'reading-list',
    name: 'Reading List',
    description: 'Track and recommend books with notes and ratings.',
    category: 'personal',
    emoji: '📚',
    gradient: 'from-amber-300/40 to-galli/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: 'My Reading List', level: 1 }),
          el({ type: 'text', content: 'Books I loved and what stuck with me.' }),
        ]),
        sec([
          el({ type: 'list', listType: 'bulleted', listTitle: 'Currently Reading', listColumns: 1, items: ['Title — Author'] }),
          el({ type: 'list', listType: 'bulleted', listTitle: 'Finished', listColumns: 1, items: ['Title — Author ★★★★★', 'Title — Author ★★★★☆'] }),
        ]),
      ],
    },
  },
  'bucket-list': {
    id: 'bucket-list',
    name: 'Bucket List',
    description: 'A checklist of goals and dreams, with inspiration.',
    category: 'personal',
    emoji: '✅',
    gradient: 'from-galli-violet/30 to-pink-300/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: 'My Bucket List', level: 1 }),
          el({ type: 'text', content: 'Everything I want to do, see, and become.' }),
        ]),
        sec([
          el({ type: 'list', listType: 'bulleted', listTitle: 'Goals', listColumns: 2, items: ['See the northern lights', 'Learn to surf', 'Visit Japan', 'Run a marathon'] }),
        ]),
        sec([el({ type: 'image', url: '', alt: 'Inspiration', caption: '' })]),
      ],
    },
  },
  'event-invite': {
    id: 'event-invite',
    name: 'Event Invite',
    description: 'A simple invite page with the details and a call to action.',
    category: 'events',
    emoji: '🎉',
    gradient: 'from-pink-300/40 to-galli-violet/20',
    seed: {
      sections: [
        sec([
          el({ type: 'heading', content: "You're Invited", level: 1 }),
          el({ type: 'text', content: 'Join us for a celebration to remember.' }),
        ]),
        sec([
          el({ type: 'list', listType: 'bulleted', listTitle: 'Details', listColumns: 1, items: ['When — Date & time', 'Where — Venue & address', 'Dress — Theme'] }),
          el({ type: 'image', url: '', alt: 'Event', caption: '' }),
        ]),
        sec([btn('RSVP')]),
      ],
    },
  },
}

export function listTemplates(): TemplateConfig[] {
  return Object.values(TEMPLATE_REGISTRY)
}
