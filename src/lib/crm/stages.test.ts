import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    crmStage: { findMany: vi.fn(), createMany: vi.fn(), delete: vi.fn() },
    crmContact: { updateMany: vi.fn(), count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { ensureStages, deleteStage, DEFAULT_STAGES } from './stages'

const stage = (id: string, order: number, name = id) => ({
  id, ownerId: 'u1', name, order, color: '#39D98A', createdAt: new Date(),
})

let callOrder: string[]

beforeEach(() => {
  vi.clearAllMocks()
  callOrder = []

  // Set up $transaction mock to track call order
  ;(db.$transaction as any).mockImplementation(async (fn: any) => {
    const mockUpdateMany = vi.fn().mockResolvedValue({ count: 3 })
    const mockDelete = vi.fn().mockResolvedValue({})

    mockUpdateMany.mockImplementation(async (...args: any[]) => {
      callOrder.push('updateMany')
      return { count: 3 }
    })

    mockDelete.mockImplementation(async (...args: any[]) => {
      callOrder.push('delete')
      return {}
    })

    const result = await fn({
      crmContact: { updateMany: mockUpdateMany },
      crmStage: { delete: mockDelete },
    })

    // Store mocks on the db mock for assertions
    ;(db.$transaction as any).lastUpdateMany = mockUpdateMany
    ;(db.$transaction as any).lastDelete = mockDelete

    return result
  })
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
    // Verify reassignment happens before delete
    expect(callOrder).toEqual(['updateMany', 'delete'])
    // Verify updateMany reassigns to the left neighbor (stage 'a')
    expect((db.$transaction as any).lastUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1', stageId: 'b' },
      data: { stageId: 'a' },
    })
    // Verify delete removes the correct stage
    expect((db.$transaction as any).lastDelete).toHaveBeenCalledWith({ where: { id: 'b' } })
  })

  it('reassigns to the right when deleting the first stage', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([
      stage('a', 0), stage('b', 1), stage('c', 2),
    ])

    const result = await deleteStage('u1', 'a')

    expect(result).toEqual({ ok: true, movedTo: 'b', moved: 3 })
    // Verify reassignment happens before delete
    expect(callOrder).toEqual(['updateMany', 'delete'])
    // Verify updateMany reassigns to the right neighbor (stage 'b')
    expect((db.$transaction as any).lastUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1', stageId: 'a' },
      data: { stageId: 'b' },
    })
    // Verify delete removes the correct stage
    expect((db.$transaction as any).lastDelete).toHaveBeenCalledWith({ where: { id: 'a' } })
  })

  it('reassigns to the left when deleting the last stage', async () => {
    ;(db.crmStage.findMany as any).mockResolvedValue([
      stage('a', 0), stage('b', 1), stage('c', 2),
    ])

    const result = await deleteStage('u1', 'c')

    expect(result).toEqual({ ok: true, movedTo: 'b', moved: 3 })
    // Verify reassignment happens before delete
    expect(callOrder).toEqual(['updateMany', 'delete'])
    // Verify updateMany reassigns to the left neighbor (stage 'b')
    expect((db.$transaction as any).lastUpdateMany).toHaveBeenCalledWith({
      where: { ownerId: 'u1', stageId: 'c' },
      data: { stageId: 'b' },
    })
    // Verify delete removes the correct stage
    expect((db.$transaction as any).lastDelete).toHaveBeenCalledWith({ where: { id: 'c' } })
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
