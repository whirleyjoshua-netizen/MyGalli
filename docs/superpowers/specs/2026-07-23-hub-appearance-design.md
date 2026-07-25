# Community Hub Appearance — Design

**Date:** 2026-07-23
**Status:** Approved for planning

## Goal

Turn on the first of the two shaded-out "Coming soon" builder settings: let a community hub owner pick a colour theme, so hubs stop all looking identically Galli-green.

## Why this shape

Two facts from the codebase drove every decision:

1. **`primary` is already a CSS variable.** Tailwind maps `primary` to `hsl(var(--primary))`, and the community components use it 35 times. Overriding `--primary` on a single wrapper re-themes all 35 usages with **zero component edits**, including the Files and Pages tabs, which render inside that wrapper.
2. **`galli` is a hardcoded hex** in `tailwind.config.ts` (`#39D98A` and friends). It appears 19 times across 13 lines in the community components; 12 of those lines represent "this hub's accent colour" and must be converted by hand, because a hex cannot respond to a variable. The 13th is a comment in `KollabWordmark`.

`sanitizeHubConfig` already runs on both read and write and coerces every field, so a new config key needs **no migration** — old hubs simply read back the default.

## Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Curated presets, not a free-form colour picker.** | `--primary-foreground` is white. A free-form pale accent produces white-on-pale buttons nobody can read. Presets pair `primary` with its foreground so contrast is correct by construction, and add no luminance maths. |
| D2 | **Theme everything except `KollabWordmark`.** | A half-themed page reads as a bug: green avatar placeholders on an orange hub look broken, and the placeholders appear in prominent spots (hub cover, every member avatar, page-card thumbnails). `KollabWordmark` is excluded because its own comment states it deliberately mints a unique gradient per instance as a brand mark, not a hub accent. |
| D3 | **Scope the variables to a wrapper inside `CommunityHubView`.** | Keeps the dashboard, top bar and every non-hub surface untouched, with no global stylesheet changes and no risk of a hub theme leaking into chrome. |

## Config

`HubConfig` gains one key:

```ts
export const HUB_THEME_KEYS = ['galli', 'ocean', 'sunset', 'violet', 'slate', 'rose'] as const
export type HubThemeKey = (typeof HUB_THEME_KEYS)[number]

// added to HubConfig
appearance: { theme: HubThemeKey }
```

`DEFAULT_HUB_CONFIG.appearance = { theme: 'galli' }`, and `sanitizeHubConfig` coerces anything not in `HUB_THEME_KEYS` back to `'galli'`. Every existing hub therefore renders exactly as it does today, and a corrupt payload cannot break the public page.

## Presets

Each preset is three HSL triples — the format the CSS variables already use.

| key | label | primary | primaryForeground | accent |
|---|---|---|---|---|
| `galli` | Galli Green | `153 64% 53%` | `0 0% 100%` | `245 100% 69%` |
| `ocean` | Ocean | `199 89% 48%` | `0 0% 100%` | `217 91% 60%` |
| `sunset` | Sunset | `21 90% 48%` | `0 0% 100%` | `340 82% 52%` |
| `violet` | Violet | `258 90% 58%` | `0 0% 100%` | `330 81% 60%` |
| `slate` | Slate | `215 25% 27%` | `0 0% 100%` | `215 20% 65%` |
| `rose` | Rose | `347 77% 50%` | `0 0% 100%` | `24 95% 53%` |

`galli.primary` is copied verbatim from the current `--primary` in `globals.css`, and `galli.accent` is the HSL of today's `galli-violet` (`#6C63FF`). This is what guarantees the default is a visual no-op.

`accent` exists because the placeholder gradients are two-stop today (`from-galli/30 to-galli-violet/30`). Without a per-preset second stop, every theme would still fade to violet.

**Known pre-existing issue, deliberately not fixed here:** white on `galli` green is weak contrast (~1.9:1). It is today's behaviour on every existing hub, so "fixing" it in the `galli` preset would silently restyle every live hub — the opposite of this design's guarantee. The five new presets are all dark enough for white text. If the Galli default should be darkened, that is its own decision affecting existing hubs, not a side effect of adding themes.

## Application

`CommunityHubView` resolves the preset and sets the variables on its outermost element:

```tsx
const t = resolveHubTheme(config.appearance.theme)
<div style={{
  '--primary': t.primary,
  '--primary-foreground': t.primaryForeground,
  '--hub-accent': t.accent,
} as React.CSSProperties}>
```

One new Tailwind token is added so the accent is usable in classes:

```ts
'hub-accent': 'hsl(var(--hub-accent))'
```

with a `:root` default in `globals.css` equal to today's galli-violet, so any use outside a hub is unaffected.

## Component conversions

Twelve hardcoded references become themeable:

| File | Change |
|---|---|
| `CommunityHeader` | `bg-galli` → `bg-primary` on Edit and Join buttons; cover and avatar placeholders → `from-primary/30 to-hub-accent/30` |
| `HubAnnouncementComposer` | `bg-galli` → `bg-primary` on Post |
| `HubAnnouncementBanner` | `border-galli/30 bg-galli/5` → `border-primary/30 bg-primary/5` |
| `CommunityHubView` | page gradient `from-galli/5` and footer `bg-galli/5` → `primary` |
| `CommunitySidebar` | icon tile `bg-galli/10` → `bg-primary/10`; two avatar placeholders → primary/hub-accent |
| `HubPagesTab` | page-card placeholder → primary/hub-accent |

Converting the Edit/Join/Post buttons also resolves a pre-existing inconsistency: those three used `bg-galli text-white` while every other button in the same views used `bg-primary text-primary-foreground`, despite serving the same visual role.

`KollabWordmark` is not touched.

## Settings UI

`HubBuilderNav` gains an `appearance` entry in `ITEMS` and loses it from `SOON`; **SEO & Sharing stays in "Coming soon"**. A new `AppearanceSection` renders a swatch grid — one button per preset showing its primary and accent, the active one marked with `aria-pressed`.

Selection updates the in-memory config through the builder's existing change handler and saves through the existing save path. **No new API endpoint and no schema change.** Because `HubBuilderPreview` renders the same `CommunityHubView`, the owner sees the theme applied before publishing.

## Error handling

| Case | Behaviour |
|---|---|
| Old hub with no `appearance` key | Sanitizer supplies `{ theme: 'galli' }` — renders exactly as today. |
| Unknown or corrupt theme key | Sanitizer coerces to `'galli'`; the page never fails to render. |
| `resolveHubTheme` given a bad key at runtime | Returns the `galli` preset rather than throwing. |

## Testing

**Unit**
- `sanitizeHubConfig`: absent `appearance` → `galli`; unknown key → `galli`; each valid key round-trips.
- `resolveHubTheme`: returns the right triples per key; unknown key falls back to `galli`.
- **The `galli` preset's `primary` equals the `--primary` value in `globals.css`** — this is the regression guard for "existing hubs look unchanged".
- Every preset defines all three fields and a non-empty label.
- `CommunityHubView` sets `--primary`, `--primary-foreground` and `--hub-accent` on its wrapper, and sets the galli values when config has no appearance key.
- `HubBuilderNav` lists Appearance as selectable and still lists SEO & Sharing as coming soon.
- `AppearanceSection` marks the active preset and reports a selection.

**Browser smoke** (production build)
- Owner switches theme in the builder; preview updates.
- Published hub with `sunset` renders orange buttons and orange→pink placeholders; the Kollab wordmark is unchanged.
- A hub with no `appearance` key is pixel-comparable to before the change.

## Out of scope

- SEO & Sharing (the other "Coming soon" entry).
- Free-form colour picking, custom fonts, dark mode (there is no dark-mode block in `globals.css` today).
- Theming non-community hubs, the dashboard, or the top bar.
- Per-tab or per-section theming.
- Changing the Galli green default's contrast.
