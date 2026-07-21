import { describe, it, expect } from 'vitest'
import { resolveTab } from '@/lib/element-os'

describe('resolveTab', () => {
  it('defaults to overview', () => {
    expect(resolveTab(null)).toBe('overview')
    expect(resolveTab('nonsense')).toBe('overview')
  })

  it('passes through the real tabs', () => {
    expect(resolveTab('overview')).toBe('overview')
    expect(resolveTab('audience')).toBe('audience')
    expect(resolveTab('interactions')).toBe('interactions')
  })

  it('redirects the retired tabs to interactions so old links keep working', () => {
    expect(resolveTab('elements')).toBe('interactions')
    expect(resolveTab('bulletin')).toBe('interactions')
  })
})
