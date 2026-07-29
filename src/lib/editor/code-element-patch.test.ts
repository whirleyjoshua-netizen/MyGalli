import { describe, it, expect } from 'vitest'
import { codeElementPatch } from './code-element-patch'

describe('codeElementPatch', () => {
  it('maps only the keys the element actually sent', () => {
    expect(codeElementPatch({ content: 'x' })).toEqual({ codeContent: 'x' })
  })

  it('does NOT emit undefined for untouched fields', () => {
    // Regression: the old inline mapping always built all five keys, so a
    // content edit wrote codeLanguage: undefined over the stored language.
    const patch = codeElementPatch({ content: 'x' })
    expect('codeLanguage' in patch).toBe(false)
    expect('codeTheme' in patch).toBe(false)
    expect('codeShowLineNumbers' in patch).toBe(false)
    expect('codeFilename' in patch).toBe(false)
  })

  it('maps every field when all are sent', () => {
    expect(
      codeElementPatch({
        content: 'c', language: 'python', theme: 'light',
        showLineNumbers: false, filename: 'a.py',
      }),
    ).toEqual({
      codeContent: 'c', codeLanguage: 'python', codeTheme: 'light',
      codeShowLineNumbers: false, codeFilename: 'a.py',
    })
  })

  it('preserves falsy values that are meaningful', () => {
    expect(codeElementPatch({ showLineNumbers: false })).toEqual({ codeShowLineNumbers: false })
    expect(codeElementPatch({ filename: '' })).toEqual({ codeFilename: '' })
  })
})
