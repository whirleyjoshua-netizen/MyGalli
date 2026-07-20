import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'
import { isAnalyticsEventType, parseInteractMetadata, parseShareChannel } from '@/lib/analytics-events'
import { countryFromHeaders } from './geo'

// Parse user agent to extract device info
function parseUserAgent(ua: string | null): {
  deviceType: string
  browser: string
  os: string
} {
  if (!ua) return { deviceType: 'unknown', browser: 'unknown', os: 'unknown' }

  // Device type
  let deviceType = 'desktop'
  if (/mobile/i.test(ua)) deviceType = 'mobile'
  else if (/tablet|ipad/i.test(ua)) deviceType = 'tablet'

  // Browser
  let browser = 'other'
  if (/chrome/i.test(ua) && !/edge|edg/i.test(ua)) browser = 'chrome'
  else if (/firefox/i.test(ua)) browser = 'firefox'
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'safari'
  else if (/edge|edg/i.test(ua)) browser = 'edge'
  else if (/opera|opr/i.test(ua)) browser = 'opera'

  // OS
  let os = 'other'
  if (/windows/i.test(ua)) os = 'windows'
  else if (/macintosh|mac os/i.test(ua)) os = 'macos'
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = 'linux'
  else if (/android/i.test(ua)) os = 'android'
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'ios'

  return { deviceType, browser, os }
}

// Parse UTM parameters from referrer URL
function parseUtmParams(referrer: string | null): {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
} {
  if (!referrer) return {}

  try {
    const url = new URL(referrer)
    return {
      utmSource: url.searchParams.get('utm_source') || undefined,
      utmMedium: url.searchParams.get('utm_medium') || undefined,
      utmCampaign: url.searchParams.get('utm_campaign') || undefined,
    }
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 60, windowMs: 60_000, prefix: 'analytics' })
  if (limited) return limited

  try {
    const body = await request.json()
    const { displayId, eventType = 'view', sessionId, metadata } = body

    if (!displayId) {
      return NextResponse.json({ error: 'displayId is required' }, { status: 400 })
    }

    if (!isAnalyticsEventType(eventType)) {
      return NextResponse.json({ error: 'Unsupported eventType' }, { status: 400 })
    }

    // Interact events must carry well-formed metadata; anything else is dropped
    // rather than persisted as junk.
    let storedMetadata: object | undefined
    if (eventType === 'interact') {
      const parsed = parseInteractMetadata(metadata)
      if (!parsed) {
        return NextResponse.json({ error: 'Invalid interact metadata' }, { status: 400 })
      }
      storedMetadata = parsed
    } else if (eventType === 'share') {
      const channel = parseShareChannel(metadata)
      storedMetadata = channel ? { channel } : undefined
    }

    // Verify display exists
    const display = await db.display.findUnique({
      where: { id: displayId },
      select: { id: true, published: true },
    })

    if (!display) {
      return NextResponse.json({ error: 'Display not found' }, { status: 404 })
    }

    // Only track published displays
    if (!display.published) {
      return NextResponse.json({ error: 'Display not published' }, { status: 403 })
    }

    // Get request info
    const userAgent = request.headers.get('user-agent')
    const referrer = request.headers.get('referer')
    const { deviceType, browser, os } = parseUserAgent(userAgent)
    const utmParams = parseUtmParams(referrer)
    const country = countryFromHeaders(request.headers)

    // Create analytics event
    const event = await db.analyticsEvent.create({
      data: {
        displayId,
        eventType,
        sessionId,
        referrer,
        userAgent,
        deviceType,
        browser,
        os,
        country,
        ...utmParams,
        metadata: storedMetadata,
      },
    })

    // If this is a view event, also increment the view counter
    if (eventType === 'view') {
      await db.display.update({
        where: { id: displayId },
        data: { views: { increment: 1 } },
      })
    }

    return NextResponse.json({ success: true, eventId: event.id })
  } catch (error) {
    console.error('Analytics track error:', error)
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 })
  }
}
