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
