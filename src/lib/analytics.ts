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

// Narrow local type for the handful of non-standard privacy-signal properties
// browsers expose on navigator/window. Deliberately NOT widened onto the
// global Navigator interface — kept as a local assertion so it can't leak
// into (or mask a real conflicting type from) other modules.
interface PrivacySignalNavigator {
  globalPrivacyControl?: boolean
  doNotTrack?: string | null
}
interface PrivacySignalWindow {
  doNotTrack?: string | null
}

// True when the visitor has signalled an opt-out via Global Privacy Control
// or Do Not Track, in any of the several places browsers have historically
// exposed it. Defensive: hostile/unusual browsers must never throw into the
// page just because we looked at navigator/window properties.
function hasPrivacyOptOut(): boolean {
  try {
    const nav = navigator as unknown as PrivacySignalNavigator
    const win = window as unknown as PrivacySignalWindow
    if (nav.globalPrivacyControl === true) return true
    if (nav.doNotTrack === '1') return true
    if (win.doNotTrack === '1') return true
    if ((navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack === '1') return true
  } catch {
    return false
  }
  return false
}

// Persistent per-browser id. Unlike the session id (sessionStorage, dies with
// the tab) this survives across visits, which is what makes "returning
// visitor" answerable. Opaque random value — no PII.
// Wrapped in try/catch because localStorage throws in some privacy modes;
// analytics must never break the page.
// Honours GPC/DNT: when the visitor has opted out, localStorage is never
// touched at all (not even to clear the existing key) and an empty string is
// returned so no persistent id is sent. The event itself still fires.
function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  if (hasPrivacyOptOut()) return ''

  try {
    let visitorId = localStorage.getItem('galli_visitor_id')
    if (!visitorId) {
      visitorId = `vis_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem('galli_visitor_id', visitorId)
    }
    return visitorId
  } catch {
    return ''
  }
}

// Track a page view
export async function trackPageView(displayId: string): Promise<void> {
  let sessionId: string | undefined
  let visitorId: string | undefined

  try {
    sessionId = getSessionId() || undefined
  } catch (error) {
    console.error('Analytics tracking failed:', error)
  }

  visitorId = getVisitorId() || undefined

  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayId,
        eventType: 'view',
        sessionId,
        visitorId,
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
  let sessionId: string | undefined
  let visitorId: string | undefined

  try {
    sessionId = getSessionId() || undefined
  } catch (error) {
    console.error('Analytics tracking failed:', error)
  }

  visitorId = getVisitorId() || undefined

  try {
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        displayId,
        eventType,
        sessionId,
        visitorId,
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
