import { describe, it, expect } from 'vitest'
import { formatNotification } from './notifications-format'

describe('formatNotification hub_drop', () => {
  it('formats with a community name', () => {
    expect(formatNotification({ type: 'hub_drop', actorName: 'Joe', contextText: 'Runners' }))
      .toBe('Joe dropped content in "Runners"')
  })
  it('formats without a community name', () => {
    expect(formatNotification({ type: 'hub_drop', actorName: 'Joe' }))
      .toBe('Joe dropped content in a community')
  })
})
