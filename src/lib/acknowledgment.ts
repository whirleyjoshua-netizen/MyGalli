// Pure acknowledgment logic. No database imports — every consumer (API routes,
// analytics card, hub post block) shares these definitions so scope keys and
// status resolution can never drift between surfaces.

export const ACK_STATEMENT_DEFAULT = 'Please confirm you have read the information above.'
export const ACK_CONFIRM_LABEL_DEFAULT = 'I have read and understood this'
export const ACK_BUTTON_LABEL_DEFAULT = 'Acknowledge'

export type AckScope = { displayId: string } | { hubPostId: string }

/**
 * Validates a request's context. Exactly one of displayId/hubPostId must be a
 * non-empty string; anything else is a malformed request.
 */
export function parseScope(input: { displayId?: unknown; hubPostId?: unknown }): AckScope | null {
  const displayId = typeof input.displayId === 'string' && input.displayId ? input.displayId : null
  const hubPostId = typeof input.hubPostId === 'string' && input.hubPostId ? input.hubPostId : null
  if (displayId && hubPostId) return null
  if (displayId) return { displayId }
  if (hubPostId) return { hubPostId }
  return null
}

/**
 * Element ids are only unique within their container: makeBlock() in
 * BlockEditor.tsx assigns deterministic ids, so the same acknowledgment block id
 * appears in every hub post that uses one. Folding the container into the key is
 * what keeps those records isolated.
 */
export function scopeKeyFor(elementId: string, scope: AckScope): string {
  return 'displayId' in scope
    ? `display:${scope.displayId}:${elementId}`
    : `hubpost:${scope.hubPostId}:${elementId}`
}

export type AckRecord = {
  userId: string
  round: number
  createdAt: Date | string
  user?: { name: string | null; username: string | null } | null
}

export type AckStatus = 'none' | 'current' | 'stale'

export function ackStatus(records: AckRecord[], currentRound: number, userId: string | null): AckStatus {
  if (!userId) return 'none'
  const mine = records.filter((r) => r.userId === userId)
  if (mine.length === 0) return 'none'
  return mine.some((r) => r.round === currentRound) ? 'current' : 'stale'
}

export type RosterEntry = {
  userId: string
  name: string
  username: string
  acknowledgedAt: string
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function buildRoster(records: AckRecord[], currentRound: number): RosterEntry[] {
  return records
    .filter((r) => r.round === currentRound)
    .map((r) => ({
      userId: r.userId,
      name: r.user?.name || r.user?.username || 'Unknown',
      username: r.user?.username || '',
      acknowledgedAt: toIso(r.createdAt),
    }))
    .sort((a, b) => b.acknowledgedAt.localeCompare(a.acknowledgedAt))
}

export function reAckProgress(
  records: AckRecord[],
  currentRound: number
): { current: number; previous: number } {
  const current = records.filter((r) => r.round === currentRound).length
  const previous = currentRound > 0 ? records.filter((r) => r.round === currentRound - 1).length : 0
  return { current, previous }
}

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function rosterCsv(entries: RosterEntry[]): string {
  const rows = [
    'Name,Username,Acknowledged At',
    ...entries.map((e) => [e.name, e.username, e.acknowledgedAt].map(csvCell).join(',')),
  ]
  return rows.join('\r\n')
}
