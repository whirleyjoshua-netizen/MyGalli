# Galli — Categorized Explore Design

**Date:** 2026-06-28
**Status:** Approved (design), pending implementation plans
**Author:** Joshua + Claude

## Overview

Make page discovery category-driven and give Explore a Netflix-style browse. Two
sequenced sub-projects, **merged independently**:
**A** — a category taxonomy, a `Display.category` field, and a categorize-on-publish gate;
**B** — a Netflix-style Explore (a horizontal row per category + Trending, search, and a
full-grid category view).

## Global Decisions

- **8 single-select categories** (one primary category per page), defined once in
  `src/lib/categories.ts`: `sports, creative, professional, business, personal, events,
  education, entertainment` (each with an `id`, human `label`, and a lucide icon name).
- **Category is required to publish**; **cover image is encouraged** (gradient + title
  fallback if skipped). Publishing without a category is blocked client-side and the
  server validates any provided category against the taxonomy.
- **Kits are creation-side only.** Discovery is by category; the old Explore **kit filter
  is removed**. Kits still power page features and remain on the editor/creation flow.
- **No backfill needed** — there are no existing published pages.
- Profile-canvas displays (`kind: 'profile'`) remain excluded from Explore (already filtered).

---

## Sub-Project A — Taxonomy + categorize-on-publish

**Goal:** A canonical category list, a `Display.category` field, and a publish dialog that
requires a category (and nudges a cover) before a page goes public.

**Taxonomy (`src/lib/categories.ts`):**
```ts
export const CATEGORIES = [
  { id: 'sports',        label: 'Sports & Athletics',     icon: 'Trophy' },
  { id: 'creative',      label: 'Creative & Portfolio',   icon: 'Palette' },
  { id: 'professional',  label: 'Professional & Resume',  icon: 'Briefcase' },
  { id: 'business',      label: 'Business & Promotional',  icon: 'Store' },
  { id: 'personal',      label: 'Personal',                icon: 'User' },
  { id: 'events',        label: 'Events & Celebrations',   icon: 'PartyPopper' },
  { id: 'education',     label: 'Education & Academic',     icon: 'GraduationCap' },
  { id: 'entertainment', label: 'Entertainment & Creators', icon: 'Sparkles' },
] as const
```
Plus `CATEGORY_IDS: string[]`, `type CategoryId`, `isValidCategory(id: string): boolean`,
and `categoryLabel(id: string): string` (label or a sensible fallback). `isValidCategory`
is unit-tested.

**Schema:** `Display.category String?` with `@@index([category])`.

**Server (`PATCH /api/displays/[id]`):** add `category` to the owner-only field set; if
`category` is provided it must satisfy `isValidCategory` (else 400). (Publishing-requires-
category is enforced in the UI; the server only validates the value.)

**Explore API (`GET /api/explore`):** replace the `kit` param/filter with a `category`
param; `where` becomes `{ published: true, kind: { not: 'profile' }, ...(category && isValidCategory(category) ? { category } : {}), ...searchFilter }`.

**Editor publish dialog:**
- New `src/components/editor/PublishDialog.tsx` (`isOpen`, `onClose`, `displayId`,
  `currentCategory`, `currentCover`, `onPublished(category, coverImage)`).
- Grid of the 8 categories (single-select); a cover-image area showing the current cover
  with an "Upload cover" (optional, via `/api/upload`); **Publish** disabled until a
  category is selected.
- Wire into `PageEditor`: the **Publish** button, when the page is currently unpublished,
  opens the dialog instead of immediately toggling; on confirm → `PATCH { published:true,
  category, coverImage? }`, set local `published`. Unpublish stays a direct toggle. When
  already published, the same control re-opens the dialog to edit category/cover.

**Verification:** `isValidCategory` tests; curl smoke: PATCH with a valid category persists,
an invalid category → 400; Explore filters by `category`. Manual: publishing an unpublished
page requires picking a category; cover optional.

---

## Sub-Project B — Netflix Explore UI

**Goal:** Replace the single filtered grid with a category-driven, cover-forward browse.

**New endpoint `GET /api/explore/rows`:** returns
`{ trending: Card[], categories: Array<{ id, label, displays: Card[] }> }` where `trending`
is the most-viewed published pages (limit ~12) and each category lists its newest ~12
published pages (only categories that have pages are returned). `Card = { id, slug, title,
coverImage, views, category, user:{username,name,avatar} }`. Excludes `kind:'profile'`.

**Explore page (`src/components/explore/ExploreClient.tsx` rebuild):**
- **Default (no search / no active category):** a **Trending** row, then **one
  horizontal-scroll row per category** (reusing the `ScrollRow` pattern), each a strip of
  cover-forward cards. A sticky row of **category chips** at the top jumps to / filters a
  category.
- **Active category** (chip selected or row "See all"): a **full responsive grid** for that
  category via `GET /api/explore?category=…` (paginated, existing infinite-scroll/load-more).
- **Search:** typing queries `GET /api/explore?search=…` and shows a results grid.
- **Cards:** a cover-forward `ExploreRowCard` (prominent image, title + author overlay,
  view count) — restyled from the current `ExploreCard`; the kit badge is dropped.
- Remove the kit filter UI entirely.

**Components:** `src/components/explore/ExploreRowCard.tsx` (cover-forward card),
`ExploreCategoryChips.tsx` (the jump/filter chips). `ExploreClient` orchestrates the three
modes (rows / category-grid / search-grid).

**Verification:** rows endpoint returns grouped data; default view shows Trending + only
non-empty category rows; clicking a chip filters to that category's grid; search works;
build + suite green; manual visual pass against the Netflix-style intent.

---

## Out of Scope (both)

Free-text tags, multi-category pages, personalized/algorithmic ranking, infinite scroll
*within* rows (paged "See all" instead), category-level cover art/branding.
