import { describe, it, expect } from 'vitest'
import { listedApps, CARD_PROVIDERS } from '@/lib/cards/registry'

describe('listedApps', () => {
  it('includes vouch (live) and kollabshare (coming-soon)', () => {
    const ids = listedApps().map((a) => a.id)
    expect(ids).toContain('vouch')
    expect(ids).toContain('kollabshare')
  })
  it('excludes the dev example card', () => {
    expect(listedApps().map((a) => a.id)).not.toContain('example')
  })
  it('marks vouch live and kollabshare coming-soon', () => {
    expect(CARD_PROVIDERS.vouch.status).toBe('live')
    expect(CARD_PROVIDERS.kollabshare.status).toBe('coming-soon')
  })
})
