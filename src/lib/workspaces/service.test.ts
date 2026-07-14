import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateWorkspaceRecord } from './service'

vi.mock('@/lib/db', () => ({
  db: {
    workspace: { findUnique: vi.fn() },
    workspaceField: { findMany: vi.fn() },
    workspaceRecord: { findFirst: vi.fn(), update: vi.fn() },
  },
}))

import { db } from '@/lib/db'

describe('updateWorkspaceRecord', () => {
  beforeEach(() => vi.clearAllMocks())

  const fields = [
    { id: 'f1', workspaceId: 'w1', key: 'grade', label: 'Grade', type: 'number', required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() },
  ]

  it('merges a changed cell into existing data', async () => {
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(fields)
    ;(db.workspaceRecord.findFirst as any).mockResolvedValue({ id: 'r1', workspaceId: 'w1', data: { grade: 80, name: 'Jo' } })
    ;(db.workspaceRecord.update as any).mockImplementation(({ data }: any) => ({ id: 'r1', ...data }))

    const res = await updateWorkspaceRecord({ userId: 'u1', workspaceId: 'w1', recordId: 'r1', patch: { grade: 95 } })
    expect(db.workspaceRecord.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { data: { grade: 95, name: 'Jo' }, updatedById: 'u1' },
    })
    expect(res.data).toEqual({ grade: 95, name: 'Jo' })
  })

  it('throws VALIDATION_ERROR on a bad cell type', async () => {
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(fields)
    ;(db.workspaceRecord.findFirst as any).mockResolvedValue({ id: 'r1', workspaceId: 'w1', data: {} })
    await expect(
      updateWorkspaceRecord({ userId: 'u1', workspaceId: 'w1', recordId: 'r1', patch: { grade: 'abc' } })
    ).rejects.toMatchObject({ type: 'VALIDATION_ERROR' })
  })

  it('throws NOT_FOUND when the record is not in the workspace', async () => {
    ;(db.workspace.findUnique as any).mockResolvedValue({ id: 'w1', ownerId: 'u1', schemaVersion: 1 })
    ;(db.workspaceField.findMany as any).mockResolvedValue(fields)
    ;(db.workspaceRecord.findFirst as any).mockResolvedValue(null)
    await expect(
      updateWorkspaceRecord({ userId: 'u1', workspaceId: 'w1', recordId: 'rX', patch: { grade: 1 } })
    ).rejects.toMatchObject({ type: 'NOT_FOUND' })
  })
})
