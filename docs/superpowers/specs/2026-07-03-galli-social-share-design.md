# Social Share (Model A) — Design

**Date:** 2026-07-03
**Status:** Approved (design)

## Problem

Published My Galli pages already unfurl nicely when a link is pasted into
platforms that read Open Graph tags (Facebook, X, LinkedIn, iMessage, WhatsApp,
Slack, Discord): `src/app/[username]/[slug]/page.tsx`'s `generateMetadata` emits
OG + Twitter Card metadata using the page's `coverImage` (big-image card when a
cover is set; branded site-wide fallback otherwise), and the card links back to
the page.

What's missing is any **share affordance**. The only sharing today is
copy-a-link: `PublishDialog` (category + cover + Publish, no share step),
`ShareDialog` (creates `/s/<code>` short links, copy to clipboard), and
`ShareProfileButton` (copies profile URL). There are no share-to-social buttons
and no native share sheet, and nothing prompts sharing after publish.

## Goal

Let users share their published page during the publish flow and anytime after,
using one-click share buttons that leverage the OG cover art already in place.

## Decisions

- **Model A — share buttons, not auto-post.** Buttons open the platform's
  pre-filled composer / the OS native share sheet; the user taps Post. **No
  account connections, no OAuth, no stored tokens, no Integrations/Settings
  page.** (Auto-posting — "tick platforms and it posts for you" — was explicitly
  rejected: it needs OAuth + token storage and is gated behind X's paid API and
  Meta app review, and cannot post to a personal IG or personal FB at all.)
- **Buttons:** X, Facebook, LinkedIn, native Share sheet, Copy link. Instagram
  has no web link-unfurl, so it is served by the native share sheet + a
  copy-for-bio hint (not its own button).
- **Entry points:** owner-only — a share step on successful publish, and a
  "Share to social" section in the editor's existing Share dialog. (A
  public-visitor share button was considered and deferred.)
- **Short links unfurl with the cover too:** `/s/<code>` currently emits a
  text-only card; add the cover image so short links match canonical links.

## Components

| File | Status | Responsibility |
|---|---|---|
| `src/lib/social-share.ts` | new | Pure URL/text builders for share intents (unit-tested) |
| `src/components/share/SocialShareButtons.tsx` | new | Reusable button row: X / Facebook / LinkedIn / native Share / Copy |
| `src/components/editor/PublishDialog.tsx` | changed | Post-publish "You're live — share it" state |
| `src/components/editor/ShareDialog.tsx` | changed | "Share to social" section above the short-link manager |
| `src/components/editor/PageEditor.tsx` | changed | Compute canonical `pageUrl`, pass to both dialogs |
| `src/app/s/[code]/page.tsx` | changed | Add cover image to `/s/` OG/Twitter metadata |

## 1. Pure helper — `src/lib/social-share.ts`

Pure, framework-free, unit-tested. All URL parameters are `encodeURIComponent`-encoded.

- `buildShareText(title: string): string` — e.g. `Check out "My Page" on My Galli`.
  Falls back to `Check out this page on My Galli` when `title` is empty/whitespace.
- `xShareUrl(url: string, text: string): string` —
  `https://twitter.com/intent/tweet?text=<enc text>&url=<enc url>`.
- `facebookShareUrl(url: string): string` —
  `https://www.facebook.com/sharer/sharer.php?u=<enc url>` (Facebook pulls the
  title/description/image from the URL's OG tags; it ignores custom text).
- `linkedInShareUrl(url: string): string` —
  `https://www.linkedin.com/sharing/share-offsite/?url=<enc url>`.

These take an already-absolute `url` (built by the caller from
`window.location.origin`).

## 2. `SocialShareButtons` — `src/components/share/SocialShareButtons.tsx`

Client component. Props: `{ url: string; title: string }`.

- **X / Facebook / LinkedIn:** each opens its share URL from `social-share.ts` in
  a new tab (`window.open(url, '_blank', 'noopener,noreferrer')`), branded icon +
  label.
- **Share… (native):** rendered **only when `navigator.share` is available** —
  detected in a `useEffect` that sets a `canNativeShare` state (avoids SSR/hydration
  mismatch, since `navigator` is undefined server-side). On click, calls
  `navigator.share({ title, text: buildShareText(title), url })`; a thrown
  `AbortError` (user cancels) is swallowed.
- **Copy link:** writes `url` to the clipboard and shows a transient "Copied"
  state.
- **Instagram hint:** a subtle caption — "Instagram: tap Share… for your story,
  or copy your link for your bio."

The component is presentation-only: it never fetches and holds no page state
beyond the local "copied" flag.

## 3. Publish flow — `PublishDialog`

- New props: `pageUrl: string`, `pageTitle: string`.
- Internal `justPublished` state. On a successful publish PATCH, set
  `justPublished = true` (and still call `onPublished(category, cover)` so the
  editor updates) instead of immediately calling `onClose`.
- When `justPublished`, the dialog body switches to a success state:
  a "You're live! 🎉 Share it" heading + `<SocialShareButtons url={pageUrl}
  title={pageTitle} />` + a **Done** button that calls `onClose`.
- The category/cover form is only shown before publishing.

## 4. Anytime after — `ShareDialog`

- New prop: `pageUrl: string`.
- Add a **"Share to social"** section at the top of the dialog body, rendered
  only when `published` is true, containing `<SocialShareButtons url={pageUrl}
  title={pageTitle} />`. The existing "Publish your page first…" warning already
  handles the unpublished case; the short-link manager below is unchanged.

## 5. Short-link cover fix — `src/app/s/[code]/page.tsx`

In `generateMetadata`, the existing query already loads `shareLink.display`
(so `coverImage` is available). Mirror the canonical page:
- Build `images = display.coverImage ? [{ url: display.coverImage }] : undefined`.
- Add `...(images && { images })` to `openGraph`.
- Set `twitter.card` to `summary_large_image` when `images` is present, else
  `summary`, and include the images.

## Wiring — `PageEditor`

- Compute the canonical URL client-side:
  `const pageUrl = user?.username ? \`${window.location.origin}/${user.username}/${slug}\` : ''`.
- Pass `pageUrl` + `pageTitle={title}` to `<PublishDialog>`; pass `pageUrl` to
  `<ShareDialog>` (which already receives `pageTitle`).
- Share buttons always target the **canonical** `/{username}/{slug}` URL (its OG
  metadata is the richest).

## Data flow

Entirely client-side navigation to third-party composers; no new API routes and
no schema changes. The `/s/` change is metadata-only (server component
`generateMetadata`). Nothing is persisted.

## Error handling

- Native share `AbortError` (user dismissed the sheet) is swallowed silently.
- Clipboard write failure: the copy button simply does not flip to "Copied"
  (best-effort; no blocking error).
- `pageUrl` empty (no username / not yet loaded): the buttons still render but the
  dialogs that use them are only opened for a loaded, saved page, so this is not a
  reachable state in practice; if `pageUrl` is empty the share section is hidden.

## Testing

- **Unit (`src/lib/social-share.ts`):** assert each builder returns the exact
  expected URL for a sample page URL + title, including encoding of spaces and
  special characters, and that `buildShareText` falls back on empty title.
- **Live / manual:**
  - Publish a page → the dialog shows the "You're live — share it" step; clicking
    X / Facebook / LinkedIn opens the correct pre-filled composer; Copy copies the
    canonical URL.
  - Editor Share button → "Share to social" section appears for a published page.
  - `curl -s http://localhost:3000/s/<code>` (a published short link with a cover)
    → HTML `<head>` contains `og:image` and `twitter:card = summary_large_image`.

## Out of scope (YAGNI)

Account connections / OAuth, auto-posting, share-click analytics, a
public-visitor share button, and extra platforms (WhatsApp / Reddit / Email) —
all intentionally excluded from this build.
