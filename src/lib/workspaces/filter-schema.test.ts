import { describe, it, expect } from 'vitest'
import { buildFilterJsonSchema, describeSchemaForPrompt } from './filter-schema'
import type { FilterField } from './filter'

const fields: FilterField[] = [
  { key: 'name', label: 'Name', type: 'text' },
  { key: 'sport', label: 'Sport', type: 'choice', config: { options: ['Soccer', 'Tennis'] } },
  { key: 'fee', label: 'Fee', type: 'currency', config: { symbol: '$' } },
]

describe('buildFilterJsonSchema', () => {
  it('enumerates only real field keys', () => {
    const schema: any = buildFilterJsonSchema(fields)
    const cond = schema.properties.conditions.items
    expect(cond.properties.field.enum).toEqual(['name', 'sport', 'fee'])
  })

  it('is closed and requires op + conditions', () => {
    const schema: any = buildFilterJsonSchema(fields)
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(['op', 'conditions'])
    expect(schema.properties.op.enum).toEqual(['and', 'or'])
    expect(schema.properties.conditions.items.additionalProperties).toBe(false)
  })

  it('is not recursive — conditions are flat', () => {
    const json = JSON.stringify(buildFilterJsonSchema(fields))
    expect(json).not.toContain('$ref')
  })
})

describe('describeSchemaForPrompt', () => {
  it('lists key, label, type and choice options', () => {
    const text = describeSchemaForPrompt(fields)
    expect(text).toContain('sport (Sport) — choice; options: Soccer, Tennis')
    expect(text).toContain('fee (Fee) — currency')
  })

  it('states the comparators each field may use', () => {
    const text = describeSchemaForPrompt(fields)
    expect(text).toContain('eq, neq, contains')       // name (text)
    expect(text).toContain('eq, neq, gt, gte, lt, lte') // fee (currency)
  })
})
