/**
 * Derive a stable, unique JSON key for a workspace field from its label.
 * Called ONCE at field creation; the key is immutable afterwards.
 */
export function deriveFieldKey(label: string, existingKeys: string[]): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_') // non-alphanumerics -> underscore
      .replace(/^_+|_+$/g, '') // trim leading/trailing underscores
    || 'field'

  if (!existingKeys.includes(base)) return base

  let n = 2
  while (existingKeys.includes(`${base}_${n}`)) n++
  return `${base}_${n}`
}
