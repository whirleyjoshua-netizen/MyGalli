import { db } from '@/lib/db'

export const DEFAULT_STAGES = [
  { name: 'New', color: '#1FB6FF' },
  { name: 'Contacted', color: '#6C63FF' },
  { name: 'Qualified', color: '#39D98A' },
  { name: 'Won', color: '#0F3D2E' },
]

export async function ensureStages(ownerId: string) {
  const existing = await db.crmStage.findMany({ where: { ownerId }, orderBy: { order: 'asc' } })
  if (existing.length > 0) return existing

  // skipDuplicates keeps two concurrent first-loads from colliding on
  // the (ownerId, name) unique.
  await db.crmStage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ ownerId, name: s.name, color: s.color, order: i })),
    skipDuplicates: true,
  })

  return db.crmStage.findMany({ where: { ownerId }, orderBy: { order: 'asc' } })
}

export type DeleteStageResult =
  | { ok: true; movedTo: string; moved: number }
  | { ok: false; reason: 'not-found' | 'last-stage' }

export async function deleteStage(ownerId: string, stageId: string): Promise<DeleteStageResult> {
  const stages = await db.crmStage.findMany({ where: { ownerId }, orderBy: { order: 'asc' } })

  const index = stages.findIndex((s) => s.id === stageId)
  if (index === -1) return { ok: false, reason: 'not-found' }
  if (stages.length === 1) return { ok: false, reason: 'last-stage' }

  // Left neighbour, or the right one when deleting the first stage.
  const target = index === 0 ? stages[1] : stages[index - 1]

  // Reassign before delete: the stageId FK is onDelete: Restrict, so the
  // delete would fail outright if any contact still pointed at this stage.
  const moved = await db.$transaction(async (tx) => {
    const { count } = await tx.crmContact.updateMany({
      where: { ownerId, stageId },
      data: { stageId: target.id },
    })
    await tx.crmStage.delete({ where: { id: stageId } })
    return count
  })

  return { ok: true, movedTo: target.id, moved }
}
