// Client-side analytics tracking

// Generate or retrieve session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return ''

  let sessionId = sessionStorage.getItem('pages_session_id')
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('pages_session_id', sessionId)
  }
  return sessionId
}

// Track a page view
export async function trackPageView(displayId: string): Promise<void> {
  try {
    const sessionId = getSessionId()

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayId,
        eventType: 'view',
        sessionId,
      }),
    })
  } catch (error) {
    // Silently fail - analytics should not break the page
    console.error('Analytics tracking failed:', error)
  }
}

// Track a custom event (click, scroll, etc.)
export async function trackEvent(
  displayId: string,
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const sessionId = getSessionId()

    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayId,
        eventType,
        sessionId,
        metadata,
      }),
    })
  } catch (error) {
    console.error('Analytics tracking failed:', error)
  }
}

// Record an interaction with a specific element (poll vote, form submit, ...).
// Fire-and-forget: never let analytics break a visitor's action.
export async function trackInteraction(
  displayId: string,
  elementId: string,
  elementType: string,
  action: string
): Promise<void> {
  if (!displayId || !elementId) return
  await trackEvent(displayId, 'interact', { elementId, elementType, action })
}

// Record that a visitor shared the page. `channel` is the share destination
// (e.g. 'twitter', 'facebook', 'copy').
export async function trackShare(displayId: string, channel: string): Promise<void> {
  if (!displayId) return
  await trackEvent(displayId, 'share', { channel })
}
