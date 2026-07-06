// Deep-walk any JSON (sections, tabs, headerCard) and collect the ids of
// every element whose type is 'live-feed'. Structure-agnostic on purpose so
// it keeps working if nesting changes.
export function findLiveFeedIds(json: unknown): string[] {
  const ids: string[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      if (obj.type === 'live-feed' && typeof obj.id === 'string') ids.push(obj.id)
      for (const value of Object.values(obj)) walk(value)
    }
  }
  walk(json)
  return Array.from(new Set(ids))
}
