# Galli — Apps Page + Library (Apps section), Pro-Gated — Design

- **Date:** 2026-06-29
- **Status:** Approved design, pre-implementation
- **Scope:** Spec #1 of the "Library" initiative. Ships the Apps storefront and the
  Library page's Apps section end-to-end. Templates and Kits sections of the Library
  are stubbed ("coming soon") and deferred to follow-on specs.

## Context — what already exists

The underlying "app card" machinery is built; this spec adds the discovery/management
surfaces and a Pro gate on top of it.

- **Card Provider Registry** — `src/lib/cards/registry.ts`. `CardProviderConfig`
  (`id, name, description, icon, type 'builtin'|'external', iframeUrl, defaultData, fields`).
  Live providers: `vouch` (external sandboxed iframe) and `example` (dev template).
- **Card Library** — `CardLibraryItem` model + `GET/POST /api/card-library` and
  `DELETE /api/card-library/[id]`. Per-user saved card instances (`provider, name, data, style`).
- **Editor insertion** — the slash menu has an **Integrations** category; selecting it opens
  `CardLibraryPicker` (`PageEditor.tsx:483`) which lists providers + the user's library items and
  inserts a card element `{provider, data, style}`. So "library Apps in the / menu" is already wired.
- **Card Studio** — `/card-studio`, builds custom iframe cards via the Galli Card SDK. Unchanged here.
- **Sidebar** — `Sidebar.tsx:39` has `{ label: 'Integrations', icon: Blocks, soon: true }` (stub, no route).
- **No Pro-tier infrastructure exists** — no `plan`/`tier`/subscription field, no billing. The
  enterprise pricing page is separate B2B content, not a consumer Free/Pro split.

## Goals

1. Rename sidebar **Integrations → Apps**; build the **Apps page** as a storefront of official
   My Galli Apps sourced from the provider registry.
2. **Add to Library** persists an App into the existing `CardLibraryItem` store.
3. Build the **Library page** as the umbrella for the user's collected content, shipping the
   **Apps section** live and **Templates / Kits** sections as clearly-labeled "coming soon" tabs.
4. Library Apps remain usable on a page via the existing slash-menu → `CardLibraryPicker` flow.
5. Gate the whole feature behind a minimal **Pro tier**: free users **browse** freely; the
   **actions** (Add to Library, use a library App on a page) are gated with an upgrade prompt.

## Non-goals (explicit — future specs)

- Templates system (net-new entity) and the Library Templates tab beyond a placeholder.
- Kits-in-Library (kits exist today only via the create-a-page flow).
- Third-party / developer-submitted Apps (only My Galli publishes Apps for now).
- Real billing / checkout for Pro. Becoming Pro = setting `User.plan = 'pro'` manually for now.

## Design

### 1. Pro-tier gate (minimal, single source of truth)

- **Schema:** add `plan String @default("free")` to `User` (values `'free' | 'pro'`).
  Migration generated via `prisma migrate diff --from-url $DATABASE_URL
  --to-schema-datamodel prisma/schema.prisma --script` → new
  `prisma/migrations/<ts>_add_user_plan/migration.sql` → `prisma migrate deploy`
  (per the repo's documented non-interactive migration workflow).
- **Helper:** `src/lib/plan.ts` → `isPro(user: { plan?: string } | null): boolean`
  (`user?.plan === 'pro'`). Used both server-side (API enforcement) and client-side (UI).
- **Auth wiring:** add `plan` to the `select` in `src/lib/auth.ts` (`getUser`/`verifyAuth`) and to
  the auth-store user hydration so `useAuthStore().user.plan` is available to client components.
- **UI primitives** (`src/components/pro/`):
  - `ProBadge` — small "Pro" pill placed on gated items.
  - `UpgradePrompt` — modal/inline "Upgrade to Pro" with a CTA. CTA target is a **stub**
    (links to `/enterprise` for now; real upgrade flow is future work).
- **Enforcement points:**
  - `POST /api/card-library` returns **403** when `!isPro(user)` (real lock — prevents adding).
  - Client "Add to Library" and "use a library App on a page" show `UpgradePrompt` for free users
    instead of calling the action.

### 2. Apps storefront — `src/app/(dashboard)/apps/page.tsx`

- Registry gains two optional fields on `CardProviderConfig`:
  - `listed?: boolean` — appears on the Apps storefront.
  - `status?: 'live' | 'coming-soon'` — `live` = addable; `coming-soon` = visible but not addable.
- Launch content:
  - `vouch` → `listed: true, status: 'live'` (the working App for build/verification).
  - `kollabshare` → **new placeholder entry**, `listed: true, status: 'coming-soon'` (flagship;
    name/description/icon are placeholders to be finalized; no working `iframeUrl` yet).
  - `example` → `listed: false` (dev only; not shown on storefront).
- Page: grid of listed Apps. Each tile shows icon, name, description, and a mini preview
  (reuse `CardLibraryPicker`'s `MiniPreview` / `IframeCardRenderer` pattern where a renderer exists).
  - `live` App → **Add to Library** button (Pro-gated). If already in the user's library →
    **In Library ✓** (disabled). Clicking when free → `UpgradePrompt`.
  - `coming-soon` App → **Coming soon** badge, no add action.
  - Free users see a `ProBadge` on actionable Apps; browsing is unrestricted.
- Sits inside the `(dashboard)` layout (sidebar present). Optional small gradient header strip to
  echo the brand treatment used on the explore header.

### 3. Library page — `src/app/(dashboard)/library/page.tsx`

- New sidebar item **Library** (lucide `Library` icon), routed to `/library`.
- Tabbed umbrella: **Apps** (live) · **Templates** (coming soon) · **Kits** (coming soon).
  Templates/Kits render a simple "Coming soon" placeholder; the tab scaffolding exists so
  follow-on specs slot in without restructuring.
- **Apps tab:**
  - Fetches `GET /api/card-library` (the signed-in user's items).
  - Each item: provider icon + name + **Use on a page** + **Remove**
    (`DELETE /api/card-library/[id]`, already exists).
  - **Use on a page** behavior: navigate to a page/editor with the library item ready to insert
    (simplest v1: link to the dashboard/editor; deep "insert this specific item" can route through
    the existing `CardLibraryPicker`). Pro-gated.
  - Empty state → CTA linking to `/apps`.

### 4. Editor surfacing (mostly exists)

- Rename the slash-menu **Integrations** category label to **Apps** (`SlashCommandMenu.tsx`
  `CATEGORY_ORDER` + the relevant entries) for naming consistency.
- `CardLibraryPicker` already lists library items + providers; gate the **insert** action behind
  Pro (free → `UpgradePrompt`). Provider list in the picker respects `listed`/`status` so
  coming-soon Apps are not insertable.

### 5. Sidebar changes — `src/components/dashboard/Sidebar.tsx`

- `Integrations` (stub) → **Apps**, `icon: Blocks`, route `/apps`, drop `soon: true`.
- Add **Library**, `icon: Library`, route `/library`.

## Data model summary

| Change | Where |
| --- | --- |
| `User.plan String @default("free")` | `prisma/schema.prisma` + new migration |
| `CardProviderConfig.listed?: boolean` | `src/lib/cards/registry.ts` |
| `CardProviderConfig.status?: 'live' \| 'coming-soon'` | `src/lib/cards/registry.ts` |
| New `kollabshare` provider entry (coming-soon placeholder) | `src/lib/cards/registry.ts` |

No new tables — `CardLibraryItem` already covers the Apps section of the Library.

## Gating behavior matrix

| Surface | Free user | Pro user |
| --- | --- | --- |
| Open Apps page / Library page | ✅ browse | ✅ |
| Add live App to Library | `UpgradePrompt`; API 403 | ✅ adds `CardLibraryItem` |
| Use library App on a page (picker insert) | `UpgradePrompt` | ✅ inserts card |
| Coming-soon App | "Coming soon", no action | "Coming soon", no action |

## Components to create

- `src/lib/plan.ts` — `isPro()`.
- `src/components/pro/ProBadge.tsx`, `src/components/pro/UpgradePrompt.tsx`.
- `src/app/(dashboard)/apps/page.tsx` (+ an `AppsClient`/`AppCard` as needed).
- `src/app/(dashboard)/library/page.tsx` (+ `LibraryClient` with tabs; reuse existing card UI).

## Testing

- `src/lib/plan.test.ts` — `isPro` truth table (`undefined`/`'free'`/`'pro'`/`null`).
- Registry: assert `listed`/`status` filtering selects the right storefront set
  (vouch live & listed, kollabshare coming-soon & listed, example not listed).
- API: `POST /api/card-library` returns 403 for free, 201 for pro (mock `getUser`).
- Live render checks: Apps page (grid + add states), Library Apps tab (list + empty),
  slash-menu insert gated, per the repo's `tsc --noEmit` + `pnpm test` + manual render workflow.

## Open items / placeholders

- **KollabShare** registry entry ships as a coming-soon placeholder (final name copy, icon, and
  description TBD by owner; no `iframeUrl` until the app is ready).
- **Upgrade CTA** target is a stub (`/enterprise`) until the real Pro upgrade flow is designed.
- This feature is part of the **Pro tier**, which is not yet established; the gate is built and
  ready to enforce once `plan` is set on accounts.
