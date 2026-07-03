# Social Share (Model A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click share buttons (X, Facebook, LinkedIn, native share sheet, copy link) to the publish flow and the editor Share dialog, plus make `/s/<code>` short links unfurl with the page cover.

**Architecture:** A pure helper (`social-share.ts`) builds platform share-intent URLs; a reusable `SocialShareButtons` client component renders the button row and opens each platform's pre-filled composer (or the OS native share sheet). It's embedded in a post-publish success state in `PublishDialog` and a "Share to social" section in `ShareDialog`. No account connections, no OAuth, no new API routes, no schema change. The `/s/` change is metadata-only.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, Vitest (jsdom).

## Global Constraints

- Model A only — share buttons that open pre-filled composers / the native share sheet. NO account connections, OAuth, stored tokens, auto-posting, or Settings/Integrations page.
- Buttons: X, Facebook, LinkedIn, native Share sheet, Copy link. Instagram is served by the native share sheet + a copy-for-bio hint (no IG button).
- Share buttons always target the **canonical** page URL `/{username}/{slug}` (richest OG metadata).
- Native "Share…" button renders ONLY when `navigator.share` exists, feature-detected in a `useEffect` (avoid SSR/hydration mismatch — `navigator` is undefined server-side).
- No new API routes; no schema/Prisma changes. The `/s/` change is `generateMetadata`-only.
- lucide-react provides `Facebook`, `Linkedin`, `Share2`, `Copy`, `Check` (verified). Use an inline SVG for the modern X logo (lucide only has the old `Twitter` bird).
- Windows/dev: verify with `npx tsc --noEmit` + `npx vitest run` + live checks. Do NOT run `pnpm build` while the dev server is running.

---

### Task 1: Pure share-URL helper

**Files:**
- Create: `src/lib/social-share.ts`
- Test: `src/__tests__/social-share.test.ts`

**Interfaces:**
- Produces:
  - `buildShareText(title: string): string`
  - `xShareUrl(url: string, text: string): string`
  - `facebookShareUrl(url: string): string`
  - `linkedInShareUrl(url: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/social-share.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildShareText, xShareUrl, facebookShareUrl, linkedInShareUrl } from '@/lib/social-share'

const URL_ = 'https://mygalli.com/josh/my-page'

describe('buildShareText', () => {
  it('wraps a title', () => {
    expect(buildShareText('My Page')).toBe('Check out "My Page" on My Galli')
  })
  it('falls back on empty/whitespace title', () => {
    expect(buildShareText('   ')).toBe('Check out this page on My Galli')
    expect(buildShareText('')).toBe('Check out this page on My Galli')
  })
})

describe('share URL builders', () => {
  it('xShareUrl points at the intent endpoint with url + text params', () => {
    const u = new URL(xShareUrl(URL_, 'hello world'))
    expect(u.origin + u.pathname).toBe('https://twitter.com/intent/tweet')
    expect(u.searchParams.get('url')).toBe(URL_)
    expect(u.searchParams.get('text')).toBe('hello world')
  })
  it('facebookShareUrl points at sharer with u param', () => {
    const u = new URL(facebookShareUrl(URL_))
    expect(u.origin + u.pathname).toBe('https://www.facebook.com/sharer/sharer.php')
    expect(u.searchParams.get('u')).toBe(URL_)
  })
  it('linkedInShareUrl points at share-offsite with url param', () => {
    const u = new URL(linkedInShareUrl(URL_))
    expect(u.origin + u.pathname).toBe('https://www.linkedin.com/sharing/share-offsite/')
    expect(u.searchParams.get('url')).toBe(URL_)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/social-share.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the helper**

Create `src/lib/social-share.ts`:

```ts
// Pure builders for social share intent URLs (Model A — pre-filled composers).
// The caller passes an already-absolute page URL (built from window.location.origin).

export function buildShareText(title: string): string {
  const t = title.trim()
  return t ? `Check out "${t}" on My Galli` : 'Check out this page on My Galli'
}

export function xShareUrl(url: string, text: string): string {
  const params = new URLSearchParams({ text, url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function facebookShareUrl(url: string): string {
  const params = new URLSearchParams({ u: url })
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`
}

export function linkedInShareUrl(url: string): string {
  const params = new URLSearchParams({ url })
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/social-share.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/social-share.ts src/__tests__/social-share.test.ts
git commit -m "feat(share): pure social share URL builders"
```

---

### Task 2: `SocialShareButtons` component

**Files:**
- Create: `src/components/share/SocialShareButtons.tsx`

**Interfaces:**
- Consumes: `xShareUrl`, `facebookShareUrl`, `linkedInShareUrl`, `buildShareText` from `@/lib/social-share` (Task 1).
- Produces: `<SocialShareButtons url={string} title={string} />` — renders the X / Facebook / LinkedIn / (native Share…) / Copy button row; returns `null` when `url` is empty.

- [ ] **Step 1: Implement the component**

Create `src/components/share/SocialShareButtons.tsx`:

```tsx
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
        Instagram: tap Share… for your story, or copy your link for your bio.
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/share/SocialShareButtons.tsx
git commit -m "feat(share): SocialShareButtons component (X/Facebook/LinkedIn/native/copy)"
```

---

### Task 3: Post-publish share step in `PublishDialog`

**Files:**
- Modify: `src/components/editor/PublishDialog.tsx`
- Modify: `src/components/editor/PageEditor.tsx`

**Interfaces:**
- Consumes: `SocialShareButtons` (Task 2).
- Produces: `PublishDialog` gains props `pageUrl: string` and `pageTitle: string`; shows a share step after a successful publish. `PageEditor` defines a `pageUrl` local (also consumed by Task 4).

- [ ] **Step 1: Add props + post-publish state to `PublishDialog`**

In `src/components/editor/PublishDialog.tsx`:

(a) Add the import at the top (after the existing imports):

```tsx
import { SocialShareButtons } from '@/components/share/SocialShareButtons'
```

(b) Extend the props type and destructuring. Replace the component signature:

```tsx
export function PublishDialog({
  isOpen,
  onClose,
  displayId,
  currentCategory,
  currentCover,
  onPublished,
  pageUrl,
  pageTitle,
}: {
  isOpen: boolean
  onClose: () => void
  displayId: string
  currentCategory: string | null
  currentCover: string | null
  onPublished: (category: string, coverImage: string | null) => void
  pageUrl: string
  pageTitle: string
}) {
```

(c) Add a `justPublished` state next to the existing `useState` calls:

```tsx
  const [justPublished, setJustPublished] = useState(false)
```

(d) In `publish()`, on success set the share step instead of closing. Replace the `if (res.ok) { ... }` block inside `publish`:

```tsx
      if (res.ok) {
        onPublished(category, cover)
        setJustPublished(true)
      }
```

(e) Render the share step. Replace the dialog body `<div className="p-5 space-y-5">...</div>` and the footer so that, when `justPublished`, the success view shows. Concretely, wrap the existing body + footer in `{!justPublished && ( ... )}` and add the success block. The full return becomes:

```tsx
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto bg-surface border border-border rounded-2xl shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h2 className="font-bold">{justPublished ? "You're live! 🎉" : 'Publish to Explore'}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {justPublished ? (
          <>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">Your page is published. Share it:</p>
              <SocialShareButtons url={pageUrl} title={pageTitle} />
            </div>
            <div className="px-5 py-3 border-t border-border flex justify-end sticky bottom-0 bg-surface">
              <button onClick={onClose} className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer">Done</button>
            </div>
          </>
        ) : (
          <>
            <div className="p-5 space-y-5">
              {/* Category (required) */}
              <div>
                <p className="text-sm font-medium mb-2">Pick a category <span className="text-destructive">*</span></p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = ICONS[c.icon] ?? Sparkles
                    const active = category === c.id
                    return (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                          active ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${active ? 'text-primary' : ''}`} />
                        <span className="text-[11px] font-medium leading-tight">{c.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Cover (encouraged) */}
              <div>
                <p className="text-sm font-medium mb-2">Cover image <span className="text-muted-foreground font-normal">(recommended)</span></p>
                <div className="flex items-center gap-3">
                  <div className={`w-28 h-16 rounded-xl overflow-hidden shrink-0 ${cover ? '' : 'bg-gradient-to-br from-galli/20 to-galli-violet/20 flex items-center justify-center'}`}>
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <label className="text-sm font-medium text-primary cursor-pointer hover:underline">
                    {cover ? 'Change cover' : 'Upload cover'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }} />
                  </label>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-surface">
              <button onClick={onClose} className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-accent transition-colors cursor-pointer">Cancel</button>
              <button onClick={publish} disabled={!category || busy} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-soft hover:brightness-105 transition-all disabled:opacity-50 cursor-pointer">
                <Check className="w-4 h-4" /> {busy ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
```

- [ ] **Step 2: Compute `pageUrl` in `PageEditor` and pass to `PublishDialog`**

In `src/components/editor/PageEditor.tsx`, add the `pageUrl` computation just after the loading guard (right after the `if (loading) { return ... }` block, near where `activeHeaderCardConfig` is computed, around line 946):

```tsx
  const pageUrl =
    typeof window !== 'undefined' && user?.username
      ? `${window.location.origin}/${user.username}/${slug}`
      : ''
```

Then update the `PublishDialog` render block (currently around lines 1239-1248) to pass the two new props:

```tsx
      {/* Publish Dialog */}
      {showPublishDialog && id && (
        <PublishDialog
          isOpen={showPublishDialog}
          onClose={() => setShowPublishDialog(false)}
          displayId={id}
          currentCategory={category}
          currentCover={coverImage}
          onPublished={(cat, cover) => { setPublished(true); setCategory(cat); setCoverImage(cover) }}
          pageUrl={pageUrl}
          pageTitle={title}
        />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Live-verify**

With the dev server running and signed in as a page owner:
- Open a page in the editor, click **Publish**, pick a category, click **Publish**.
- Expected: the dialog switches to "You're live! 🎉" with X / Facebook / LinkedIn / Copy buttons (and "Share…" on a mobile/`navigator.share` browser). Clicking **X** opens `twitter.com/intent/tweet` pre-filled with the page URL; **Copy** copies `https://<origin>/<username>/<slug>`.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/PublishDialog.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(share): post-publish share step in PublishDialog"
```

---

### Task 4: "Share to social" section in `ShareDialog`

**Files:**
- Modify: `src/components/editor/ShareDialog.tsx`
- Modify: `src/components/editor/PageEditor.tsx`

**Interfaces:**
- Consumes: `SocialShareButtons` (Task 2); the `pageUrl` local in `PageEditor` (Task 3).
- Produces: `ShareDialog` gains prop `pageUrl: string`; shows a social-share section when `published`.

- [ ] **Step 1: Add the prop + social section to `ShareDialog`**

In `src/components/editor/ShareDialog.tsx`:

(a) Add the import (after the existing imports):

```tsx
import { SocialShareButtons } from '@/components/share/SocialShareButtons'
```

(b) Extend `ShareDialogProps` and the destructuring to include `pageUrl`:

```tsx
interface ShareDialogProps {
  displayId: string
  pageTitle: string
  published: boolean
  pageUrl: string
  onClose: () => void
}
```

```tsx
export function ShareDialog({ displayId, pageTitle, published, pageUrl, onClose }: ShareDialogProps) {
```

(c) Add the social section at the very top of the dialog body — immediately inside `<div className="p-5">`, before the "Unpublished warning" block:

```tsx
          {/* Share to social (published pages only) */}
          {published && (
            <div className="mb-5 pb-5 border-b border-border">
              <label className="text-sm font-medium text-foreground block mb-2">
                Share to social
              </label>
              <SocialShareButtons url={pageUrl} title={pageTitle} />
            </div>
          )}

```

- [ ] **Step 2: Pass `pageUrl` from `PageEditor`**

In `src/components/editor/PageEditor.tsx`, update the `ShareDialog` render block (currently around lines 1219-1226) to pass `pageUrl` (the local defined in Task 3):

```tsx
      {showShareDialog && id && (
        <ShareDialog
          displayId={id}
          pageTitle={title}
          published={published}
          pageUrl={pageUrl}
          onClose={() => setShowShareDialog(false)}
        />
      )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Live-verify**

Signed in as owner, open a **published** page in the editor → click **Share** → the dialog shows a "Share to social" section (X / Facebook / LinkedIn / Copy) above the short-link manager. On an **unpublished** page the section is hidden and the existing "Publish your page first…" warning shows.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/ShareDialog.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(share): Share to social section in ShareDialog"
```

---

### Task 5: `/s/<code>` short links unfurl with the cover

**Files:**
- Modify: `src/app/s/[code]/page.tsx`

**Interfaces:**
- None new. Metadata-only change in `generateMetadata`.

- [ ] **Step 1: Add the cover image to the OG/Twitter metadata**

In `src/app/s/[code]/page.tsx`, the `generateMetadata` query already loads `shareLink.display` (so `coverImage` is present). Replace the `return { ... }` at the end of `generateMetadata`:

```tsx
  const images = shareLink.display.coverImage ? [{ url: shareLink.display.coverImage }] : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${appUrl}/s/${code}`,
      ...(images && { images }),
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(images && { images }),
    },
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Live-verify the meta tags**

With the dev server running, for a published short link whose display has a cover image:

```bash
curl -s http://localhost:3000/s/<code> | grep -iE 'og:image|twitter:card'
```
Expected: an `og:image` tag with the cover URL and `twitter:card` = `summary_large_image`. (For a display with no cover, `og:image` is absent and `twitter:card` = `summary` — unchanged behavior.)

- [ ] **Step 4: Commit**

```bash
git add src/app/s/[code]/page.tsx
git commit -m "feat(share): /s short links unfurl with cover image"
```

---

### Task 6: Full verification

**Files:** none.

- [ ] **Step 1: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass (including the 5 new `social-share` tests).

- [ ] **Step 2: End-to-end live check** (dev server running, signed in as owner)

1. Unpublished page → **Publish** → pick category → **Publish** → "You're live! 🎉" share step appears; **X** opens the pre-filled composer; **Copy** copies the canonical URL.
2. Published page → **Share** → "Share to social" section present above short links.
3. `curl` a `/s/<code>` short link with a cover → `og:image` + `twitter:card: summary_large_image`.
4. Sanity: paste a published page URL into a link-preview debugger (or a chat app) → unfurls with cover + title, links back to the page.

- [ ] **Step 3: Deploy (fix→push→deploy cadence)**

```bash
git push origin main
vercel ls my-galli   # confirm the new production deploy goes Ready + takes mygalli.com
```

---

## Notes for the implementer

- No schema/Prisma changes and no new API routes — this is UI + one metadata edit.
- Share buttons must use the canonical `/{username}/{slug}` URL, never the `/s/` short link (canonical has the richest OG).
- Do not add account connections, OAuth, auto-posting, or a Settings/Integrations page — explicitly out of scope.
