export const REPORT_REASONS = ['spam', 'harassment', 'explicit', 'violence', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_TARGET_TYPES = ['post', 'comment', 'drop', 'member'] as const
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number]

export type NormalizedReport = {
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  note: string | null
}

export function validateReportInput(
  raw: unknown,
): { ok: true; value: NormalizedReport } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const targetType = r.targetType
  if (!(REPORT_TARGET_TYPES as readonly unknown[]).includes(targetType)) return { ok: false, error: 'Invalid target' }
  const targetId = typeof r.targetId === 'string' ? r.targetId.trim() : ''
  if (!targetId) return { ok: false, error: 'Invalid target' }
  const reason = r.reason
  if (!(REPORT_REASONS as readonly unknown[]).includes(reason)) return { ok: false, error: 'Invalid reason' }
  const note = typeof r.note === 'string' && r.note.trim() ? r.note.trim().slice(0, 500) : null
  return {
    ok: true,
    value: { targetType: targetType as ReportTargetType, targetId, reason: reason as ReportReason, note },
  }
}
