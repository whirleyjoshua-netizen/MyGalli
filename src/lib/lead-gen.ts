// Pure helpers for the Lead Gen element. No DB / no Next imports — safe to unit test.

// Deliberately conservative: one @, non-empty local part, a dotted domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email.trim())
}

export interface LeadGenNode {
  id: string
  type: string
  leadGenMessage?: string
  leadGenFileUrl?: string
  leadGenFileName?: string
  leadGenCollectName?: boolean
}

// Deep-walk arbitrary display JSON (sections or tabs) for a `lead-gen` element.
// The element's emailed content is ALWAYS read from the stored display via this
// helper, never from the request body — otherwise a crafted POST could make us
// send arbitrary text and links to a third party from our sending domain.
export function findLeadGenElement(json: unknown, elementId: string): LeadGenNode | null {
  let found: LeadGenNode | null = null
  const walk = (node: unknown) => {
    if (found) return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.type === 'lead-gen' && obj.id === elementId) {
        found = obj as unknown as LeadGenNode
        return
      }
      for (const v of Object.values(obj)) walk(v)
    }
  }
  walk(json)
  return found
}
