# Galli — Library: Templates + Kits tabs — Design

- **Date:** 2026-06-29
- **Status:** Approved design, pre-implementation
- **Scope:** Follow-on to the Apps + Library spec. Makes the Library's **Templates** and
  **Kits** tabs live (they currently render "coming soon"). One spec covers both — they share
  the gallery pattern, the page-create path, and the Pro gate.

## Context — what already exists

- **Library page** (`/library`, `src/components/library/LibraryClient.tsx`) has three tabs:
  Apps (live), **Templates (soon)**, **Kits (soon)**. This spec turns the latter two live.
- **Kits** are a full system: 7 kits registered in `src/lib/kits/*.ts` via `registerKit` into
  `KIT_REGISTRY` (`src/lib/kits/registry.ts`); `generateKitDisplay(kit, userName)` (`generate.ts`)
  produces seed `sections`/`tabs`/`headerCard`/`kitConfig`. The orphaned `/new-kit` page is a kit
  gallery that does `POST /api/displays {title, kitId}` → editor. **`/new-kit` is not linked
  anywhere in the UI today.**
- **Page creation** (`POST /api/displays`, `src/app/api/displays/route.ts`): accepts `{title,
  description, kitId}`. With `kitId` it seeds from `generateKitDisplay`; otherwise a blank page.
  It already writes `sections`/`tabs`/`headerCard`/`kitConfig`, so a template (raw seed JSON) seeds
  a page the same way. **Currently ungated** (kits are free today).
- **Pro infra** (from the Apps spec): `isPro(user)` (`src/lib/plan.ts`), `ProBadge`,
  `UpgradePrompt` (`src/components/pro/`), `useRefreshUser()` (`src/lib/use-refresh-user.ts`),
  `User.plan`. Pattern: free users browse; only actions gate (client `UpgradePrompt` + server 403).

## Goals

1. **Templates tab** — a gallery of official My Galli curated templates; "Use" seeds a new page and
   opens the editor.
2. **Kits tab** — a gallery of the existing kits (gives the orphaned kit gallery a home); "Use"
   creates a page from the kit (existing path).
3. **Per-item Pro gate** — a `pro?` flag on templates and kits. **All 7 kits = Pro.** Curated
   templates ship **free** (flag available for future premium ones). Browse free; "Use" on a Pro
   item gates via `UpgradePrompt` + server 403.
4. Interaction model is **gallery → "Use" creates a page now** (no "collect/download" step).

## Non-goals (explicit — future specs)

- User-saved templates ("save my page as a template"), template ownership, a `Template` DB table.
- Real cover-image uploads for templates (v1 uses gradient + emoji covers, no new assets).
- Repointing the landing "Start with inspiration" carousel; premium merchandising/analytics.
- New billing — Pro is still set manually via `User.plan` (upgrade CTA remains the `/enterprise` stub).

## Design

### 1. Template registry — `src/lib/templates/registry.ts`

```ts
export interface TemplateConfig {
  id: string
  name: string
  description: string
  category: string          // reuse a value from src/lib/categories.ts where sensible
  emoji: string             // cover glyph (paired with a gradient class in the UI)
  gradient: string          // tailwind gradient classes for the cover tile
  pro?: boolean             // gate "Use" when true (defaults free)
  seed: {
    sections: unknown[]     // CanvasElement[][]-shaped section data (authored)
    headerCard?: unknown    // optional HeaderCardConfig
    tabs?: unknown          // optional tabs config
  }
}

export const TEMPLATE_REGISTRY: Record<string, TemplateConfig>
export function listTemplates(): TemplateConfig[]   // Object.values(TEMPLATE_REGISTRY)
```

**Starter templates (all free for launch).** Each `seed.sections` is authored with existing element
types (`heading`, `text`, `image`, `link`, `list`, `button`, `divider`, etc.) using `createElement`
defaults so they render in the editor and public page unchanged:

| id | name | seed content (high level) |
| --- | --- | --- |
| `link-in-bio` | Link-in-Bio | header (heading + short bio text + avatar image), a stack of link buttons, a socials row |
| `travel-itinerary` | Travel Itinerary | trip heading + intro text, a per-day list of stops, an image gallery section |
| `reading-list` | Reading List | heading + intro, a list of books (title/author/rating notes), a "currently reading" callout |
| `bucket-list` | Bucket List | heading + intro, a checklist-style list of goals, an inspiration image grid |
| `event-invite` | Event Invite | hero heading + date/place text, details list, a photo, a closing CTA button |

Authoring the exact seed JSON is the bulk of the implementation and lives in the plan, not here.

### 2. Kit Pro flag — `src/lib/kits/`

- Add `pro?: boolean` to `KitConfig` (`src/lib/kits/registry.ts`).
- Set `pro: true` in all 7 kit definitions (`athlete`, `resume`, `wedding`, `creative`, `creator`,
  `academic`, `business`).
- Add a `listKits()` helper that returns all registered kits (ensuring every kit module is imported
  so the registry is populated — today only `/new-kit` imports them; the Library and the API need
  them too). Centralize the kit-module imports in one module (e.g. `src/lib/kits/all.ts`) that the
  registry consumers import, so registration isn't duplicated.

### 3. Create-from-X + Pro enforcement — `POST /api/displays`

- Accept an optional `templateId`. When present, resolve `TEMPLATE_REGISTRY[templateId]` and seed
  `sections`/`headerCard`/`tabs` from its `seed` (mirrors the existing `kitId` branch). Unknown id → 400.
- **Pro enforcement (new):** before seeding, if the requested item is Pro and the user is not:
  - `kitId` → look up `KIT_REGISTRY[kitId]`; if `kit.pro && !isPro(user)` → **403**.
  - `templateId` → look up `TEMPLATE_REGISTRY[templateId]`; if `template.pro && !isPro(user)` → **403**.
  - No `kitId`/`templateId` (blank page) → unchanged, **free**.
- `isPro` reads `user.plan` (already selected by `getUser`).

### 4. Library UI — `src/components/library/LibraryClient.tsx`

- **Templates** and **Kits** tabs become live galleries (replace the "coming soon" placeholders). A
  shared gallery sub-component renders a grid of cover tiles: emoji-on-gradient cover, name,
  description, a `ProBadge` when the item is `pro` and the viewer is free, and a **Use** button.
- **Use** handler: if item is `pro` and `!isPro(user)` → open `UpgradePrompt`; else
  `POST /api/displays { title: 'My ' + name, templateId | kitId }` → on ok `router.push('/editor?id='
  + display.id)`; on 403 → open `UpgradePrompt`; on other error → inline error message.
- **Deep-link:** read `?tab=apps|templates|kits` (via `useSearchParams`) to set the initial tab;
  keep the existing Apps tab behavior. Templates/Kits tabs lose their `soon` flag.
  NOTE: `useSearchParams` requires a Suspense boundary in the App Router — `src/app/(dashboard)/
  library/page.tsx` must wrap `<LibraryClient />` in `<Suspense>` (else the build errors / the route
  deopts). A trivial fallback (e.g. an empty `<div>`) is fine.
- Reuse `useRefreshUser()` (already called in `LibraryClient`) so a fresh Pro upgrade reflects.

### 5. Cleanup — `/new-kit`

- Replace `src/app/(dashboard)/new-kit/page.tsx` with a redirect to `/library?tab=kits` (the
  canonical kit gallery). Implementation preserved in git history. (No sidebar/UI links to update —
  it was already orphaned.)

## Data flow

```
Library Templates/Kits tab  ──Use──▶  gate (client isPro)
   │ free user, Pro item                       │ pro user OR free item
   ▼                                            ▼
UpgradePrompt                      POST /api/displays {templateId|kitId}
                                            │ server: pro item & !isPro ─▶ 403 ─▶ UpgradePrompt
                                            ▼ seed sections/headerCard/tabs
                                     Display created ─▶ /editor?id=…
```

## Components / files

- Create: `src/lib/templates/registry.ts` (+ the 5 seed templates), `src/lib/kits/all.ts` (central
  kit imports), `src/__tests__/templates-registry.test.ts`.
- Modify: `src/lib/kits/registry.ts` (`pro?` on `KitConfig`, `listKits()`), the 7 kit files
  (`pro: true`), `src/app/api/displays/route.ts` (templateId + Pro 403), `LibraryClient.tsx`
  (live galleries + `?tab`), `src/app/(dashboard)/new-kit/page.tsx` (redirect).

## Testing

- `listTemplates()` returns the registry; each template `seed.sections` is a non-empty array;
  starter templates are `free` (no `pro`).
- Kit `pro` flag: all 7 kits report `pro === true`; `listKits()` returns 7.
- Create path: `POST /api/displays {templateId}` seeds from the registry (happy path); a Pro
  kit/template with a free user → 403; a blank page (no id) → still allowed.
- Live render: `/library?tab=templates` and `?tab=kits` show galleries; "Use" on a free template
  creates a page and routes to the editor; "Use" on a kit as a free user shows `UpgradePrompt`.

## Open items / placeholders

- Seed-content JSON for the 5 templates is authored in the implementation plan (the heaviest task).
- Pro upgrade flow remains a stub (`/enterprise`); becoming Pro is still a manual `plan='pro'`.
- Template covers are gradient + emoji (no image assets) — real cover art is a later enhancement.
