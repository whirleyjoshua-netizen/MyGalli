import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    crmStage: { findMany: vi.fn(), createMany: vi.fn(), delete: vi.fn() },
    crmContact: { updateMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn({
      crmContact: { updateMany: vi.fn().mockResolvedValue({ count: 3 }) },
      crmStage: { delete: vi.fn().mockResolvedValue({}) },
    })),
  },
}))

import { db } from '@/lib/db'
import { ensureStages, deleteStage, DEFAULT_STAGES } from './stages'

const stage = (id: string, order: number, name = id) => ({
  id, ownerId: 'u1', name, order, color: '#39D98A', createdAt: new Date(),
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ensureStages', () => {
  it('seeds the defaults when the owner has none', async () => {
    ;(db.crmStage.findMany as any)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(DEFAULT_STAGES.map((s, i) => stage(`s${i}`, i, s.name)))

    const result = await ensureStages('u1')

    expect(db.crmStage.createMany).toHaveBeenCalledWith({
      data: DEFAULT_STAGES.map((s, i) => ({ ownerId: 'u1', name: s.name, color: s.color, order: i })),
      skipDuplicates: true,
    })
    expect(result.map((s) => s.name)).toEqual(DEFAULT_STAGES.map((s) => s.name))
  })

  it('is idempotent — does not seed when stages already exist', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([stage('s1', 0, 'New')])

    const result = await ensureStages('u1')

    expect(db.crmStage.createMany).not.toHaveBeenCalled()
    expect(result).toHaveLength(1)
  })
})

describe('deleteStage', () => {
  it('reassigns contacts to the stage on the left', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([
      stage('a', 0), stage('b', 1), stage('c', 2),
    ])

    const result = await deleteStage('u1', 'b')

    expect(result).toEqual({ ok: true, movedTo: 'a', moved: 3 })
  })

  it('reassigns to the right when deleting the first stage', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([
      stage('a', 0), stage('b', 1), stage('c', 2),
    ])

    const result = await deleteStage('u1', 'a')

    expect(result).toEqual({ ok: true, movedTo: 'b', moved: 3 })
  })

  it('refuses to delete the last remaining stage', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([stage('a', 0)])

    expect(await deleteStage('u1', 'a')).toEqual({ ok: false, reason: 'last-stage' })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('reports not-found for a stage the owner does not have', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([stage('a', 0), stage('b', 1)])

    expect(await deleteStage('u1', 'someone-elses')).toEqual({ ok: false, reason: 'not-found' })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})
