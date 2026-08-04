import { db } from '@/lib/db'

export const DEFAULT_STAGES = [
  { name: 'New', color: '#1FB6FF' },
  { name: 'Contacted', color: '#6C63FF' },
  { name: 'Qualified', color: '#39D98A' },
  { name: 'Won', color: '#0F3D2E' },
]

// `order` is not unique, so it alone is not a total ordering. Every read of a
// stage list must break ties the same way, or two reads of the same data can
// disagree — which is how the delete dialog ends up naming a different
// destination than the one the server actually reassigns to.
export const STAGE_ORDER = [{ order: 'asc' as const }, { id: 'asc' as const }]

export async function ensureStages(ownerId: string) {
  const existing = await db.crmStage.findMany({ where: { ownerId }, orderBy: STAGE_ORDER })
  if (existing.length > 0) return existing

  // skipDuplicates keeps two concurrent first-loads from colliding on
  // the (ownerId, name) unique.
  await db.crmStage.createMany({
    data: DEFAULT_STAGES.map((s, i) => ({ ownerId, name: s.name, color: s.color, order: i })),
    skipDuplicates: true,
  })

  return db.crmStage.findMany({ where: { ownerId }, orderBy: STAGE_ORDER })
}

export type DeleteStageResult =
  | { ok: true; movedTo: string; moved: number }
  | { ok: false; reason: 'not-found' | 'last-stage' | 'conflict' }

export async function deleteStage(ownerId: string, stageId: string): Promise<DeleteStageResult> {
  try {
    return await db.$transaction(async (tx) => {
      // Lock this owner's stage rows before reading them. Reading outside the
      // transaction meant two concurrent deletes could both see two stages,
      // both clear the last-stage guard, and both commit — leaving the owner
      // with zero stages and a board they cannot add to. The same stale
      // snapshot could also make each transaction reassign contacts onto the
      // stage the other was deleting, and the second delete would then hit the
      // Restrict FK as an unhandled P2003 500.
      await tx.$queryRaw`SELECT id FROM "CrmStage" WHERE "ownerId" = ${ownerId} FOR UPDATE`

      const stages = await tx.crmStage.findMany({ where: { ownerId }, orderBy: STAGE_ORDER })

      const index = stages.findIndex((s) => s.id === stageId)
      if (index === -1) return { ok: false as const, reason: 'not-found' as const }
      if (stages.length === 1) return { ok: false as const, reason: 'last-stage' as const }

      // Left neighbour, or the right one when deleting the first stage.
      const target = index === 0 ? stages[1] : stages[index - 1]

      // Reassign before delete: the stageId FK refuses to drop a stage that
      // still has contacts, so this ordering is load-bearing, not cosmetic.
      const { count } = await tx.crmContact.updateMany({
        where: { ownerId, stageId },
        data: { stageId: target.id },
      })
      await tx.crmStage.delete({ where: { id: stageId } })

      return { ok: true as const, movedTo: target.id, moved: count }
    })
  } catch (error) {
    // P2003 = FK violation, P2034 = write conflict / deadlock. Both mean a
    // concurrent stage edit beat us; the caller should retry rather than see
    // a 500.
    const code = (error as { code?: string })?.code
    if (code === 'P2003' || code === 'P2034') return { ok: false, reason: 'conflict' }
    throw error
  }
}
