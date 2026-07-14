export type WorkspaceAgg = 'count' | 'sum' | 'avg' | 'min' | 'max'

export function computeAggregate(
  records: Array<{ data: Record<string, any> }>,
  fieldKey: string,
  agg: WorkspaceAgg
): number | null {
  if (agg === 'count') return records.length

  const nums = records
    .map((r) => r.data?.[fieldKey])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

  if (nums.length === 0) return null

  switch (agg) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0)
    case 'avg': {
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length
      return Math.round(avg * 100) / 100
    }
    case 'min':
      return Math.min(...nums)
    case 'max':
      return Math.max(...nums)
  }
}
