// Render a stored form-response answer as readable text. Answers may be a
// scalar, an array (multi-select), or a structured object (RSVP, wedding-rsvp,
// business-review) — the last of which would otherwise show "[object Object]".
export function formatResponseAnswer(answer: unknown): string {
  if (answer === null || answer === undefined) return ''
  if (Array.isArray(answer)) return answer.join(', ')
  if (typeof answer === 'object') {
    return Object.entries(answer as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('/') : String(v)}`)
      .join(' · ')
  }
  return String(answer)
}
