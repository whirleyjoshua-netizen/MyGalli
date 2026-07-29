import type { CanvasElement } from '@/lib/types/canvas'

export interface CodeElementUpdates {
  content?: string
  language?: string
  theme?: 'dark' | 'light'
  showLineNumbers?: boolean
  filename?: string
}

/**
 * Translate CodeElement's prop-named updates into stored CanvasElement fields.
 *
 * Only keys present in `updates` are emitted. Building all five keys
 * unconditionally wrote `undefined` over the stored language/theme/filename
 * every time the author typed a character, because updateElement merges with
 * `{ ...el, ...updates }` and undefined overwrites.
 */
export function codeElementPatch(updates: CodeElementUpdates): Partial<CanvasElement> {
  const patch: Partial<CanvasElement> = {}
  if (updates.content !== undefined) patch.codeContent = updates.content
  if (updates.language !== undefined) patch.codeLanguage = updates.language
  if (updates.theme !== undefined) patch.codeTheme = updates.theme
  if (updates.showLineNumbers !== undefined) patch.codeShowLineNumbers = updates.showLineNumbers
  if (updates.filename !== undefined) patch.codeFilename = updates.filename
  return patch
}
