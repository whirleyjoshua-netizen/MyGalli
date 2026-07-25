export function checklistProgress(items: { done: boolean }[]): { done: number; total: number; pct: number } {
  const total = items.length
  const done = items.filter((i) => i.done).length
  // 0 items ⇒ pct 0, never NaN.
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, pct }
}
