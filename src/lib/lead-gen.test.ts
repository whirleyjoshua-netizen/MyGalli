import { describe, it, expect } from 'vitest'
import { isValidEmail, findLeadGenElement } from './lead-gen'

describe('isValidEmail', () => {
  it('accepts normal addresses', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('sarah.jones+news@example.co.uk')).toBe(true)
  })
  it('rejects malformed addresses', () => {
    for (const bad of ['', 'nope', 'a@', '@b.com', 'a b@c.com', 'a@b']) {
      expect(isValidEmail(bad)).toBe(false)
    }
  })
  it('rejects an over-long address', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@b.com`)).toBe(false)
  })
})

describe('findLeadGenElement', () => {
  const display = {
    sections: [
      {
        columns: [
          {
            elements: [
              { id: 'x', type: 'text' },
              {
                id: 'lg1',
                type: 'lead-gen',
                leadGenMessage: 'hi',
                leadGenFileUrl: 'https://blob/x.pdf',
                leadGenFileName: 'x.pdf',
              },
            ],
          },
        ],
      },
    ],
  }

  it('finds a lead-gen element by id', () => {
    const el = findLeadGenElement(display.sections, 'lg1')
    expect(el?.leadGenMessage).toBe('hi')
    expect(el?.leadGenFileName).toBe('x.pdf')
  })

  it('returns null for an unknown id', () => {
    expect(findLeadGenElement(display.sections, 'nope')).toBeNull()
  })

  it('does not match a same-id element of a different type', () => {
    expect(findLeadGenElement(display.sections, 'x')).toBeNull()
  })

  it('finds an element nested inside a tabs config', () => {
    const tabs = {
      tabs: [
        { label: 'One', sections: [{ columns: [{ elements: [{ id: 'a', type: 'text' }] }] }] },
        {
          label: 'Two',
          sections: [
            { columns: [{ elements: [{ id: 'lg2', type: 'lead-gen', leadGenMessage: 'deep' }] }] },
          ],
        },
      ],
    }
    expect(findLeadGenElement(tabs, 'lg2')?.leadGenMessage).toBe('deep')
  })

  it('tolerates null and non-object input', () => {
    expect(findLeadGenElement(null, 'lg1')).toBeNull()
    expect(findLeadGenElement('a string', 'lg1')).toBeNull()
  })
})
