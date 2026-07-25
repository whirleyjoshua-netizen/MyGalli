import { describe, it, expect } from 'vitest'
import type { Section } from '@/lib/types/canvas'
import type { TabsConfig } from '@/lib/types/tabs'
import { isValidTimeZone, findElement, setStamp, clearStamp, setStampAnywhere, clearStampAnywhere } from './element-stamp'

function sections(): Section[] {
  return [
    { id: 's1', layout: 'full-width', columns: [
      { id: 'c1', elements: [{ id: 'e1', type: 'text', content: 'hello' }] },
    ] },
    { id: 's2', layout: 'full-width', columns: [
      { id: 'c2', elements: [
        { id: 'e2', type: 'image', url: 'https://x/a.jpg' },
        { id: 'e3', type: 'heading', content: 'hi', stampedAt: '2026-01-01T00:00:00.000Z', stampedTz: 'UTC' },
      ] },
    ] },
  ]
}

describe('isValidTimeZone', () => {
  it('accepts a real IANA zone', () => {
    expect(isValidTimeZone('America/New_York')).toBe(true)
  })
  it('rejects nonsense, non-strings and empty', () => {
    expect(isValidTimeZone('Mars/Olympus_Mons')).toBe(false)
    expect(isValidTimeZone(42)).toBe(false)
    expect(isValidTimeZone('')).toBe(false)
    expect(isValidTimeZone(undefined)).toBe(false)
  })
})

describe('findElement', () => {
  it('finds an element in a later section and column', () => {
    expect(findElement(sections(), 'e3')?.type).toBe('heading')
  })
  it('returns null for an unknown id', () => {
    expect(findElement(sections(), 'nope')).toBeNull()
  })
})

describe('setStamp', () => {
  it('sets both fields on the target element only', () => {
    const next = setStamp(sections(), 'e1', '2026-07-23T19:30:00.000Z', 'America/New_York')!
    expect(findElement(next, 'e1')).toMatchObject({
      stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'America/New_York',
    })
    expect(findElement(next, 'e2')?.stampedAt).toBeUndefined()
  })

  it('overwrites an existing stamp (re-stamp)', () => {
    const next = setStamp(sections(), 'e3', '2026-07-23T19:30:00.000Z', 'Europe/London')!
    expect(findElement(next, 'e3')).toMatchObject({
      stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'Europe/London',
    })
  })

  it('omits stampedTz when not supplied', () => {
    const next = setStamp(sections(), 'e1', '2026-07-23T19:30:00.000Z')!
    expect(findElement(next, 'e1')?.stampedTz).toBeUndefined()
  })

  it('does not mutate the input', () => {
    const input = sections()
    setStamp(input, 'e1', '2026-07-23T19:30:00.000Z', 'UTC')
    expect(findElement(input, 'e1')?.stampedAt).toBeUndefined()
  })

  it('preserves every other field of the target element', () => {
    const next = setStamp(sections(), 'e2', '2026-07-23T19:30:00.000Z', 'UTC')!
    expect(findElement(next, 'e2')).toMatchObject({ type: 'image', url: 'https://x/a.jpg' })
  })

  it('returns null for an unknown id', () => {
    expect(setStamp(sections(), 'nope', '2026-07-23T19:30:00.000Z', 'UTC')).toBeNull()
  })
})

describe('clearStamp', () => {
  it('removes both fields', () => {
    const next = clearStamp(sections(), 'e3')!
    const el = findElement(next, 'e3')!
    expect(el.stampedAt).toBeUndefined()
    expect(el.stampedTz).toBeUndefined()
    expect(el.content).toBe('hi')
  })
  it('returns null for an unknown id', () => {
    expect(clearStamp(sections(), 'nope')).toBeNull()
  })
})

// Finding 2a: a page can route its elements through tabs instead of the
// top-level `sections`. setStamp/clearStamp alone only ever see one
// Section[], so setStampAnywhere/clearStampAnywhere try the top level first,
// then each tab, and report back a whole { sections, tabs } structure.
function tabsWithElement(): TabsConfig {
  return {
    enabled: true,
    tabs: [
      {
        id: 'tab1', label: 'One', slug: 'one',
        sections: [
          { id: 'ts1', layout: 'full-width', columns: [
            { id: 'tc1', elements: [{ id: 'te1', type: 'text', content: 'in a tab' }] },
          ] },
        ],
      },
      {
        id: 'tab2', label: 'Two', slug: 'two',
        sections: [
          { id: 'ts2', layout: 'full-width', columns: [
            { id: 'tc2', elements: [{ id: 'te2', type: 'text', content: 'also in a tab' }] },
          ] },
        ],
      },
    ],
  }
}

describe('setStampAnywhere / clearStampAnywhere (tab-aware)', () => {
  it('stamps an element that lives inside a (non-first) tab, not the top-level sections', () => {
    const target = { sections: sections(), tabs: tabsWithElement() }
    const next = setStampAnywhere(target, 'te2', '2026-07-23T19:30:00.000Z', 'UTC')!
    expect(next).not.toBeNull()
    // Untouched: nothing in the top-level sections changed.
    expect(next.sections).toBe(target.sections)
    // The element was found and stamped inside tab2's sections.
    const stampedEl = next.tabs?.tabs[1].sections[0].columns[0].elements[0]
    expect(stampedEl).toMatchObject({ id: 'te2', stampedAt: '2026-07-23T19:30:00.000Z', stampedTz: 'UTC' })
    // Its sibling tab is untouched.
    expect(next.tabs?.tabs[0]).toBe(target.tabs.tabs[0])
  })

  it('prefers the top-level sections when the id exists there', () => {
    const target = { sections: sections(), tabs: tabsWithElement() }
    const next = setStampAnywhere(target, 'e1', '2026-07-23T19:30:00.000Z', 'UTC')!
    expect(findElement(next.sections, 'e1')).toMatchObject({ stampedAt: '2026-07-23T19:30:00.000Z' })
    expect(next.tabs).toBe(target.tabs)
  })

  it('does not mutate the input tabs config', () => {
    const target = { sections: sections(), tabs: tabsWithElement() }
    setStampAnywhere(target, 'te1', '2026-07-23T19:30:00.000Z', 'UTC')
    expect(target.tabs.tabs[0].sections[0].columns[0].elements[0].stampedAt).toBeUndefined()
  })

  it('returns null when the id is absent from both sections and tabs', () => {
    const target = { sections: sections(), tabs: tabsWithElement() }
    expect(setStampAnywhere(target, 'nope', '2026-07-23T19:30:00.000Z')).toBeNull()
  })

  it('returns null when tabs is null and the id is not in sections', () => {
    const target = { sections: sections(), tabs: null }
    expect(setStampAnywhere(target, 'te1', '2026-07-23T19:30:00.000Z')).toBeNull()
  })

  it('clearStampAnywhere removes a stamp from an element living inside a tab', () => {
    const stampedTabs = tabsWithElement()
    stampedTabs.tabs[0].sections[0].columns[0].elements[0].stampedAt = '2026-01-01T00:00:00.000Z'
    stampedTabs.tabs[0].sections[0].columns[0].elements[0].stampedTz = 'UTC'
    const target = { sections: sections(), tabs: stampedTabs }

    const next = clearStampAnywhere(target, 'te1')!
    const el = next.tabs?.tabs[0].sections[0].columns[0].elements[0]
    expect(el?.stampedAt).toBeUndefined()
    expect(el?.stampedTz).toBeUndefined()
    expect(el?.content).toBe('in a tab')
  })
})
