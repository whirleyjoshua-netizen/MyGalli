import { describe, it, expect } from 'vitest'
import { validateWorkspaceRecord } from './workspace-validator'
import { WorkspaceField } from '@prisma/client'

describe('validateWorkspaceRecord', () => {
  const fields: WorkspaceField[] = [
    { id: '1', workspaceId: 'w1', key: 'name', label: 'Name', type: 'text', required: true, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() },
    { id: '2', workspaceId: 'w1', key: 'grade', label: 'Grade', type: 'number', required: true, position: 1, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() },
  ]

  it('validates correct data', () => {
    const input = { name: 'Jordan', grade: 95 }
    const result = validateWorkspaceRecord(fields, input)
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'Jordan', grade: 95 })
  })

  it('fails on wrong type', () => {
    const input = { name: 'Jordan', grade: 'A' }
    const result = validateWorkspaceRecord(fields, input)
    expect(result.success).toBe(false)
    expect(result.errors).toEqual({ grade: 'Must be a number' })
  })

  it('fails on unknown field in strict mode', () => {
    const input = { name: 'Jordan', grade: 95, extra: 'oops' }
    const result = validateWorkspaceRecord(fields, input)
    expect(result.success).toBe(false)
    expect(result.errors).toEqual({ extra: 'Unknown field' })
  })

  it('coerces checkbox to boolean', () => {
    const f: WorkspaceField[] = [
      { id: '3', workspaceId: 'w1', key: 'active', label: 'Active', type: 'checkbox', required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() },
    ]
    expect(validateWorkspaceRecord(f, { active: 'true' }).data).toEqual({ active: true })
    expect(validateWorkspaceRecord(f, { active: '' }).data).toEqual({ active: false })
  })

  it('does NOT block on missing required (soft required)', () => {
    const result = validateWorkspaceRecord(fields, { name: 'Jordan' })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ name: 'Jordan', grade: null })
  })

  it('partial mode validates only provided keys and does not null-fill', () => {
    const result = validateWorkspaceRecord(fields, { grade: 90 }, { partial: true })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ grade: 90 })
  })

  it('partial mode still rejects unknown keys', () => {
    const result = validateWorkspaceRecord(fields, { nope: 1 }, { partial: true })
    expect(result.success).toBe(false)
    expect(result.errors).toEqual({ nope: 'Unknown field' })
  })

  it('coerces currency and percent to numbers', () => {
    const f = (type: string): any => [{ id: '1', workspaceId: 'w', key: 'v', label: 'V', type, required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() }]
    expect(validateWorkspaceRecord(f('currency'), { v: '12.5' }).data).toEqual({ v: 12.5 })
    expect(validateWorkspaceRecord(f('percent'), { v: 95 }).data).toEqual({ v: 95 })
  })
  it('clamps + rounds rating to 0..max', () => {
    const f: any = [{ id: '1', workspaceId: 'w', key: 'r', label: 'R', type: 'rating', required: false, position: 0, config: { max: 5 }, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() }]
    expect(validateWorkspaceRecord(f, { r: 9 }).data).toEqual({ r: 5 })
    expect(validateWorkspaceRecord(f, { r: -2 }).data).toEqual({ r: 0 })
    expect(validateWorkspaceRecord(f, { r: 3.7 }).data).toEqual({ r: 4 })
  })
  it('stores url/email as strings', () => {
    const f = (type: string): any => [{ id: '1', workspaceId: 'w', key: 'v', label: 'V', type, required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() }]
    expect(validateWorkspaceRecord(f('url'), { v: 'example.com' }).data).toEqual({ v: 'example.com' })
    expect(validateWorkspaceRecord(f('email'), { v: 'a@b.com' }).data).toEqual({ v: 'a@b.com' })
  })
})
