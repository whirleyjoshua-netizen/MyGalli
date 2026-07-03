'use client'

import { useState, useEffect } from 'react'
import { Facebook, Linkedin, Share2, Copy, Check } from 'lucide-react'
import { xShareUrl, facebookShareUrl, linkedInShareUrl, buildShareText } from '@/lib/social-share'

// lucide's `Twitter` is the old bird; use the modern X glyph.
function XLogo() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.65l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

export function SocialShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)
  const [canNativeShare, setCanNativeShare] = useState(false)

  // Feature-detect in an effect so SSR and first client render match.
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  if (!url) return null

  const text = buildShareText(title)
  const open = (u: string) => window.open(u, '_blank', 'noopener,noreferrer')

  const nativeShare = async () => {
    try {
      await navigator.share({ title: title || 'My Galli', text, url })
    } catch {
      // user cancelled (AbortError) or unsupported — ignore
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard blocked — best effort, no error surfaced
    }
  }

  const btn =
    'flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition cursor-pointer'

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => open(xShareUrl(url, text))} className={btn} aria-label="Share on X">
          <XLogo /> X
        </button>
        <button onClick={() => open(facebookShareUrl(url))} className={btn} aria-label="Share on Facebook">
          <Facebook className="w-4 h-4" /> Facebook
        </button>
        <button onClick={() => open(linkedInShareUrl(url))} className={btn} aria-label="Share on LinkedIn">
          <Linkedin className="w-4 h-4" /> LinkedIn
        </button>
        {canNativeShare && (
          <button onClick={nativeShare} className={btn} aria-label="Share via device">
            <Share2 className="w-4 h-4" /> Share…
          </button>
        )}
        <button onClick={copy} className={btn} aria-label="Copy link">
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Instagram: {canNativeShare ? 'tap Share… for your story, or ' : ''}copy your link for your bio.
      </p>
    </div>
  )
}
