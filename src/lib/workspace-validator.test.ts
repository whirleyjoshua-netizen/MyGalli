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

  it('fails on missing required field', () => {
    const input = { name: 'Jordan' }
    const result = validateWorkspaceRecord(fields, input)
    expect(result.success).toBe(false)
    expect(result.errors).toEqual({ grade: 'Grade is required' })
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
})
