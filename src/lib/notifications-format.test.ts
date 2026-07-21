import { describe, it, expect } from 'vitest'
import { formatNotification } from './notifications-format'

describe('formatNotification', () => {
  it('follow', () => {
    expect(formatNotification({ type: 'follow', actorName: 'Sofia' })).toBe('Sofia started following you')
  })
  it('bulletin', () => {
    expect(formatNotification({ type: 'bulletin', actorName: 'Marcus' })).toBe('Marcus posted a bulletin')
  })
  it('page_published with and without a title', () => {
    expect(formatNotification({ type: 'page_published', actorName: 'Ava', contextText: 'My Trip' })).toBe('Ava published “My Trip”')
    expect(formatNotification({ type: 'page_published', actorName: 'Ava' })).toBe('Ava published a new page')
  })
  it('comment with and without a title', () => {
    expect(formatNotification({ type: 'comment', actorName: 'Guest', contextText: 'My Trip' })).toBe('Guest commented on “My Trip”')
    expect(formatNotification({ type: 'comment', actorName: 'Guest' })).toBe('Guest commented on your page')
  })
  it('message with and without a page title', () => {
    expect(formatNotification({ type: 'message', actorName: 'Someone', contextText: 'My Page' })).toBe('Someone sent you a message on “My Page”')
    expect(formatNotification({ type: 'message', actorName: 'Ann', contextText: null })).toBe('Ann sent you a message')
  })
})

describe('formatNotification — hub community types', () => {
  it('formats hub_post with the hub title', () => {
    expect(formatNotification({ type: 'hub_post', actorName: 'Ada', contextText: 'Smoke Hub' }))
      .toBe('Ada posted in “Smoke Hub”')
  })

  it('formats hub_comment with the hub title', () => {
    expect(formatNotification({ type: 'hub_comment', actorName: 'Ada', contextText: 'Smoke Hub' }))
      .toBe('Ada commented on your post in “Smoke Hub”')
  })

  it('falls back gracefully when contextText is missing', () => {
    expect(formatNotification({ type: 'hub_post', actorName: 'Ada' })).toBe('Ada posted in a community')
    expect(formatNotification({ type: 'hub_comment', actorName: 'Ada' })).toBe('Ada commented on your post')
  })
})

describe('kollab drop notifications', () => {
  it('tells the owner a drop needs review', () => {
    expect(formatNotification({ type: 'hub_drop_pending', actorName: 'Sam', contextText: 'Frog Club' }))
      .toBe('Sam dropped content in “Frog Club” — review it')
  })
  it('tells the author their drop is live', () => {
    expect(formatNotification({ type: 'hub_drop_approved', actorName: 'Jo', contextText: 'Frog Club' }))
      .toBe('Your drop is live in “Frog Club”')
  })
  it('tells the author their drop was not approved', () => {
    expect(formatNotification({ type: 'hub_drop_rejected', actorName: 'Jo', contextText: 'Frog Club' }))
      .toBe('Your drop in “Frog Club” wasn’t approved')
  })
})
