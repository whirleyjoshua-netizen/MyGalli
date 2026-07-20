import { describe, it, expect } from 'vitest'
import { validateReportInput, REPORT_REASONS } from './hub-reports'

const valid = { targetType: 'post', targetId: 'p1', reason: 'spam' }

describe('validateReportInput', () => {
  it('accepts a valid report', () => {
    const r = validateReportInput(valid)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ targetType: 'post', targetId: 'p1', reason: 'spam', note: null })
  })

  it('accepts every documented reason', () => {
    for (const reason of REPORT_REASONS) {
      expect(validateReportInput({ ...valid, reason }).ok).toBe(true)
    }
  })

  it('rejects a reason outside the vocabulary', () => {
    expect(validateReportInput({ ...valid, reason: 'because' })).toEqual({ ok: false, error: 'Invalid reason' })
  })

  it('rejects an unknown target type', () => {
    expect(validateReportInput({ ...valid, targetType: 'hub' })).toEqual({ ok: false, error: 'Invalid target' })
  })

  it('rejects a missing or non-string target id', () => {
    expect(validateReportInput({ ...valid, targetId: '' }).ok).toBe(false)
    expect(validateReportInput({ ...valid, targetId: 42 }).ok).toBe(false)
  })

  it('truncates an overlong note to 500 chars', () => {
    const r = validateReportInput({ ...valid, note: 'x'.repeat(900) })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.note?.length).toBe(500)
  })

  it('does not throw on hostile input', () => {
    for (const bad of [null, undefined, 'string', 42, []]) {
      expect(validateReportInput(bad).ok).toBe(false)
    }
  })
})
