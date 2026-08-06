'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface IframeCardRendererProps {
  url: string
  data: Record<string, any>
  style: 'default' | 'compact' | 'detailed'
  theme?: 'light' | 'dark'
}

const MIN_HEIGHT = 20
const MAX_HEIGHT = 2000
const LOAD_TIMEOUT = 10000
const HANDSHAKE_RETRY = 300

export function IframeCardRenderer({ url, data, style, theme = 'light' }: IframeCardRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const readyRef = useRef(false)
  const pendingDataRef = useRef<Record<string, any> | null>(null)
  const [iframeHeight, setIframeHeight] = useState(100)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const containerWidthRef = useRef(0)

  const sendInit = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    iframe.contentWindow.postMessage({
      type: 'gallio:init',
      version: 1,
      data,
      style,
      theme,
      containerWidth: containerWidthRef.current,
    }, '*')
  }, [data, style, theme])

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      // Only accept messages from our iframe
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return
      const msg = event.data
      if (!msg || typeof msg.type !== 'string') return

      if (msg.type === 'gallio:ready') {
        readyRef.current = true
        setError(false)
        sendInit()
      }

      if (msg.type === 'gallio:height' && typeof msg.height === 'number') {
        // A height reply is proof the card is alive, whether or not we caught
        // its ready broadcast. Treat it as the handshake completing so the
        // poll below stops and the failure state can't fire on a working card.
        readyRef.current = true
        setError(false)
        const clamped = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.ceil(msg.height)))
        setIframeHeight(clamped)
        setLoaded(true)
      }
    }

    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [sendInit])

  // Re-send data when props change
  useEffect(() => {
    if (readyRef.current) {
      sendInit()
    } else {
      pendingDataRef.current = data
    }
  }, [data, style, theme, sendInit])

  // The iframe is server-rendered, so the browser starts loading it during
  // HTML parse — well before React hydrates and attaches the message listener
  // above. The card's `gallio:ready` broadcast lands in that gap and is lost,
  // the load timeout then fires, and every visitor sees "This card failed to
  // load" on a card that is working perfectly. Clicking Retry only "fixed" it
  // because by then the listener existed.
  //
  // An onLoad handler does not help: if the iframe finished loading before
  // hydration, that event has already fired and attaching a handler after the
  // fact never sees it. So drive the handshake from this side instead — poll
  // init until the card answers. The SDK re-measures on init, so its height
  // reply doubles as the acknowledgement.
  useEffect(() => {
    if (readyRef.current) return
    sendInit()
    const poll = setInterval(() => {
      if (readyRef.current) {
        clearInterval(poll)
        return
      }
      sendInit()
    }, HANDSHAKE_RETRY)
    return () => clearInterval(poll)
  }, [url, retryKey, sendInit])

  // Load timeout
  useEffect(() => {
    readyRef.current = false
    setLoaded(false)
    setError(false)

    const timeout = setTimeout(() => {
      if (!readyRef.current) {
        setError(true)
      }
    }, LOAD_TIMEOUT)

    return () => clearTimeout(timeout)
  }, [url, retryKey])

  // Track container width
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerWidthRef.current = Math.round(entry.contentRect.width)
      }
    })
    ro.observe(wrapper)
    return () => ro.disconnect()
  }, [])

  if (error) {
    return (
      <div className="p-6 rounded-xl border-2 border-dashed border-border bg-muted/30 text-center">
        <p className="text-sm text-muted-foreground mb-3">This card failed to load</p>
        <button
          onClick={() => setRetryKey(k => k + 1)}
          className="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative rounded-xl overflow-hidden">
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 bg-muted/30 animate-pulse rounded-xl" />
      )}
      <iframe
        key={retryKey}
        ref={iframeRef}
        src={url}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: `${iframeHeight}px`,
          border: 'none',
          display: 'block',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.2s ease',
        }}
        title="External card"
      />
    </div>
  )
}
