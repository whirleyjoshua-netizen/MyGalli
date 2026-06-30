import { describe, it, expect } from 'vitest'
import '@/lib/kits/all'
import { listKits } from '@/lib/kits/registry'

describe('kits Pro flag', () => {
  it('registers all 7 kits', () => {
    expect(listKits()).toHaveLength(7)
  })
  it('marks every kit as Pro', () => {
    expect(listKits().every((k) => k.pro === true)).toBe(true)
  })
})
