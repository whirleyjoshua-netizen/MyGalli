# Lily Pond Landing Page — Design

**Date:** 2026-06-30
**Status:** Approved, ready for plan
**Topic:** Redesign the My Galli marketing landing page into a single fixed, no-scroll
"lily pond" scene where bottom-of-page content floats on top of the hero image as
clickable lily pads that open themed popups.

## Goal

Replace the current vertically-scrolling marketing landing page with a single
full-viewport scene built on the existing `public/hero-village.png` art. Nothing
scrolls on landing: the hero fills the screen and all former bottom-of-page content
"floats" on top — surfaced through a small set of clickable lily pads that open
storybook-themed popups.

## Non-Goals

- No change to auth pages, dashboard, editor, or public page rendering.
- No new backend, data model, or API work — this is purely a marketing-page redesign.
- No new hero artwork — reuse the existing `hero-village.png`.
- No replacement of the existing template/feature/testimonial *copy* — it is reused
  verbatim inside popups (placeholder stats remain flagged as before).

## User-Facing Behavior

### The fixed scene (desktop / tablet, `md` and up)
- The page is a single full-viewport scene: `h-screen` (using dynamic viewport height
  where supported) with `overflow-hidden`. The page itself never scrolls.
- `hero-village.png` fills the scene via `object-cover`, with object-position chosen so
  the "Welcome to MY GALLI" sign and the foreground pond/path remain visible across
  common aspect ratios.
- A **translucent glass nav** floats at the top: the "My Galli" logo (frog + wordmark)
  on the left; "Log in" and "Get started" on the right. It overlays the art rather than
  using the solid gradient bar.
- A **persistent primary CTA** ("Create your first page" → `/signup`, with the
  "No code. No limits. Just your ideas." subline) is anchored in the lower-center
  foreground, over the path.
- **Three floating lily pads** sit in the lower third of the scene. Each shows a short
  label and opens a popup when clicked (see mapping below).

### The three lily pads → popups
1. **"Your world, your rules"** → popup containing all four feature blocks:
   - *Anything, your way* — "Build a page for any idea — athlete profile, resume,
     wedding, mood board, guide. Drag, drop, done."
   - *Interactive by default* — "Add polls, questions, quizzes, ratings, and trackers.
     Make your page come alive, not just sit there."
   - *Share anywhere* — "Get a clean link at galli.page/you instantly. Embed it, share
     it, make it yours."
   - *Built for everyone* — "Follow friends, collaborate live, and explore. Whether it's
     for work, passion, or fun — My Galli is for everyone."
   - Reuses the existing CSS "mock UI" art (AnythingArt / InteractiveArt / ShareArt /
     EveryoneArt) from `FeatureSection.tsx`.
2. **"Start with inspiration"** → popup containing the template gallery (Athlete Profile,
   Resume, Wedding, Travel Map, Mood Board, Book List — emoji + gradient tiles, Popular/New
   tags) plus an "Explore all templates" link to `/explore`. Tiles link to `/signup`.
3. **"Loved by creators"** → popup containing the testimonial quote ("My Galli turns my
   thoughts into interactive experiences people actually enjoy." — Maya Thompson) and the
   three stats (10K+ Pages created / 200K+ Interactions / 150+ Countries). These remain
   PLACEHOLDER marketing copy and stay flagged as such.

The former **FinalCTA** section is removed; its intent is served by the persistent CTA
button. The former **LandingFooter** is dropped from the fixed scene (its
"Made with My Galli" / legal links are not required on a no-scroll landing; revisit later
if needed).

### Pad & popup look and feel
- Pads are green rounded lily-pad shapes with the signature wedge notch, a soft drop
  shadow, and a centered label. They sit in the foreground (water/grass edge).
- Hover: the pad bobs/lifts gently (transform + shadow transition); cursor pointer.
  Keyboard-focusable (`button`), visible focus ring, `aria-haspopup="dialog"`.
- Click opens a **storybook-themed modal**: fixed dimmed overlay, centered cream/parchment
  card with a soft wooden-brown border accent and a green heading, an X close button
  (top-right), close on overlay click and on `Escape`. Focus moves into the dialog on open
  and returns to the triggering pad on close.
- If a popup's content is taller than the viewport, the content area scrolls *inside* the
  modal (`max-h` + `overflow-y-auto`); the page underneath never scrolls.

### Mobile fallback (below `md`)
- The scene does not force-fit. Instead: the hero image renders as a banner at the top,
  followed by the three pad labels as a clean **stacked list of buttons**, plus the nav
  (logo + Log in / Get started) and the persistent CTA.
- Tapping a button opens the same popup/modal as on desktop.
- Layout aims for minimal-to-no page scroll on a typical phone and must look intentional,
  not cramped.

## Architecture

New components under `src/components/marketing/`:

- **`LilyPond.tsx`** (client component) — owns the scene. Renders the fixed background
  image, the glass nav, the persistent CTA, and the three pads. Holds local state for
  which popup is open (`useState<PadId | null>`). Provides the responsive split
  (fixed scene at `md+`, stacked fallback below `md`) via Tailwind classes / a small
  layout branch. Defines the pad config (id, label, position).
- **`PadModal.tsx`** — storybook-themed modal wrapper. Props: `isOpen`, `onClose`,
  `title`, `children`. Handles overlay, centering, X button, `Escape`, overlay-click
  close, focus management, and internal scroll for tall content. Follows the existing
  modal/panel conventions in the codebase (overlay + centered dialog + X close).
- **`popups/FeaturesPopup.tsx`**, **`popups/TemplatesPopup.tsx`**, **`popups/LovedPopup.tsx`**
  — the three content bodies. Copy and CSS art are lifted/reused from the existing
  `FeatureSection.tsx`, `TemplateCarousel.tsx`, and `Testimonial.tsx`.

`src/app/page.tsx` is simplified to render `<LilyPond imageSrc={heroImage} />` and keeps
the existing `resolveHeroImage()` progressive-enhancement helper. The previous stacked
flow (`LandingNav` solid bar, `Hero`, `FeatureSection`, `TemplateCarousel`, `Testimonial`,
`FinalCTA`, `LandingFooter`) is no longer composed on the landing route.

### Disposition of existing components
- `Hero.tsx`, `FeatureSection.tsx`, `TemplateCarousel.tsx`, `Testimonial.tsx`,
  `FinalCTA.tsx`, `LandingNav.tsx`, `LandingFooter.tsx` are no longer rendered by
  `page.tsx`. They remain in the repo (source of the reused copy/art and available for
  reference / future use). No deletion required for this change.

## Data Flow

- Pure presentational. One piece of UI state: `openPad: PadId | null` in `LilyPond`.
- Clicking a pad sets `openPad`; `PadModal` renders when `openPad` matches; closing sets
  it back to `null`.
- No network calls. Links (`/signup`, `/login`, `/explore`) use Next `Link`.

## Accessibility & Error Handling

- Pads and nav actions are real `button`/`Link` elements, keyboard-operable, with focus
  rings. Modal is a labelled dialog (`role="dialog"`, `aria-modal`, `aria-labelledby`).
- `Escape` and overlay click close the modal; focus is trapped while open and restored to
  the trigger on close. Body scroll is locked while a modal is open (defensive — the page
  is already non-scrolling at `md+`).
- The fixed scene uses an accessible `h1` (visually hidden, since the headline lives in the
  art): "My Galli — make any idea interactive."
- If `resolveHeroImage()` returns null (no `hero-village.png`), the scene falls back to a
  CSS gradient/pond background so pads and content still work (graceful degradation).

## Testing

- This is a visual/marketing change with minimal logic. Verification is primarily live:
  run the dev server and confirm at desktop and mobile widths that (a) the desktop scene
  is fixed and non-scrolling with all three pads visible and the CTA reachable, (b) each
  pad opens the correct popup and closes via X / overlay / Escape, (c) the mobile fallback
  stacks cleanly and the popups still open, (d) `tsc --noEmit` passes and `pnpm test` stays
  green (no existing tests should break; no new unit tests are required for presentational
  components).
- Per the Windows build gotcha, prefer `tsc --noEmit` + live render checks over `pnpm build`
  while the dev server is running.

## Open Questions

None — design approved.
