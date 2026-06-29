# Galli Categorized Explore — Sub-project A (Taxonomy + Categorize-on-Publish)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Add a category taxonomy, a `Display.category` field, a publish dialog that requires a category (cover encouraged), and switch Explore's API filter from kit to category.

**Architecture:** A canonical, tested `src/lib/categories.ts` is the single source of truth. `Display.category` stores one id; `PATCH /api/displays/[id]` accepts+validates it (owner-only); the editor's Publish flow opens a dialog that requires a category before going public. `/api/explore` filters by `category` instead of kit.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, Vitest, lucide-react, Tailwind.

## Global Constraints

- **8 single-select categories**, ids: `sports, creative, professional, business, personal, events, education, entertainment` — defined ONCE in `src/lib/categories.ts`.
- **Category required to publish** (enforced in the publish dialog); **cover encouraged** (optional, gradient+title fallback). Server validates any provided `category` against the taxonomy (400 if invalid).
- **Kits are creation-side only** — Explore's `kit` filter is replaced by `category`.
- **DB safety + migrations (repo memory):** machine `DATABASE_URL` overrides `.env` — inline each command: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>`. Migrations via `migrate diff … --script` → write `prisma/migrations/<ts>_<name>/migration.sql` → `migrate deploy`; confirm datasource `pages`/`5434`. **`prisma generate` EPERMs while a dev server runs** — if so, ask the user to stop it, regenerate, restart.
- Verify: `pnpm exec tsc --noEmit`, `pnpm test`. **Don't run `pnpm build` while a dev server runs** (`.next` race → phantom errors); rely on tsc + tests + live smoke, or stop the server first. Auth: `getUser`. Async params.

---

### Task 1: Schema — Display.category + migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/20260628050000_add_display_category/migration.sql`.

- [ ] **Step 1:** Add to `model Display`: `category String?` and `@@index([category])` (alongside the existing `@@index` lines).
- [ ] **Step 2:** Generate + inspect SQL — `npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma\schema.prisma --script` (confirm datasource; additive: `ALTER TABLE "Display" ADD COLUMN "category" TEXT;` + `CREATE INDEX "Display_category_idx" ON "Display"("category");`). Write to the migration.sql path.
- [ ] **Step 3:** Apply — `npx prisma migrate deploy`; then `npx prisma generate` (if EPERM, ask user to stop dev server, retry, restart).
- [ ] **Step 4:** Verify + commit
```
docker exec pages-mvp-postgres-1 psql -U pages -d pages -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='Display' AND column_name='category';"
```
```bash
git add prisma/schema.prisma prisma/migrations/20260628050000_add_display_category
git commit -m "feat(explore): add Display.category + index migration"
```

---

### Task 2: Category taxonomy (TDD)

**Files:** Create `src/lib/categories.ts`, `src/__tests__/categories.test.ts`.

**Interfaces:** `CATEGORIES: ReadonlyArray<{ id: string; label: string; icon: string }>`; `CATEGORY_IDS: string[]`; `type CategoryId`; `isValidCategory(id: string): boolean`; `categoryLabel(id: string): string`.

- [ ] **Step 1: Write failing tests**
```ts
// src/__tests__/categories.test.ts
import { describe, it, expect } from 'vitest'
import { isValidCategory, categoryLabel, CATEGORY_IDS } from '@/lib/categories'

describe('isValidCategory', () => {
  it('accepts known ids', () => {
    expect(isValidCategory('sports')).toBe(true)
    expect(isValidCategory('entertainment')).toBe(true)
  })
  it('rejects unknown ids', () => {
    expect(isValidCategory('nope')).toBe(false)
    expect(isValidCategory('')).toBe(false)
  })
})

describe('categoryLabel', () => {
  it('returns the label for a known id', () => {
    expect(categoryLabel('professional')).toBe('Professional & Resume')
  })
  it('falls back to Other for unknown', () => {
    expect(categoryLabel('zzz')).toBe('Other')
  })
})

describe('CATEGORY_IDS', () => {
  it('has the 8 categories', () => {
    expect(CATEGORY_IDS.length).toBe(8)
  })
})
```
- [ ] **Step 2: Run — expect fail.**
- [ ] **Step 3: Implement**
```ts
// src/lib/categories.ts
export const CATEGORIES = [
  { id: 'sports', label: 'Sports & Athletics', icon: 'Trophy' },
  { id: 'creative', label: 'Creative & Portfolio', icon: 'Palette' },
  { id: 'professional', label: 'Professional & Resume', icon: 'Briefcase' },
  { id: 'business', label: 'Business & Promotional', icon: 'Store' },
  { id: 'personal', label: 'Personal', icon: 'User' },
  { id: 'events', label: 'Events & Celebrations', icon: 'PartyPopper' },
  { id: 'education', label: 'Education & Academic', icon: 'GraduationCap' },
  { id: 'entertainment', label: 'Entertainment & Creators', icon: 'Sparkles' },
] as const

export type CategoryId = (typeof CATEGORIES)[number]['id']

export const CATEGORY_IDS: string[] = CATEGORIES.map((c) => c.id)

export function isValidCategory(id: string): boolean {
  return CATEGORY_IDS.includes(id)
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}
```
- [ ] **Step 4: Run — expect pass. Commit.**
```bash
git add src/lib/categories.ts src/__tests__/categories.test.ts
git commit -m "feat(explore): tested category taxonomy"
```

---

### Task 3: API — PATCH validates category + Explore filters by category

**Files:** Modify `src/app/api/displays/[id]/route.ts`, `src/app/api/explore/route.ts`.

**Interfaces:** Consumes `isValidCategory`. `PATCH` accepts owner-only `category`; rejects an invalid value with 400. `GET /api/explore?category=<id>` filters by category (the `kit` param is removed).

- [ ] **Step 1: PATCH — allow + validate category.** In `src/app/api/displays/[id]/route.ts`: add `'category'` to the known-fields array (currently `['title', 'description', 'published', 'sections', 'background', 'headerCard', 'tabs', 'coverImage']`). Import `isValidCategory` from `@/lib/categories`. After `const { data, rejected } = splitUpdate(known, isOwner)` and the `rejected` check, add:
```ts
    if (data.category !== undefined && data.category !== null && !isValidCategory(String(data.category))) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
```
(`category` is owner-only because it is not in `COLLAB_FIELDS`.)

- [ ] **Step 2: Explore — swap kit for category.** In `src/app/api/explore/route.ts`:
  - Add `import { isValidCategory } from '@/lib/categories'`.
  - Remove `const KNOWN_KITS = …`, the `buildKitFilter` function, `const kit = …`, and `const kitFilter = buildKitFilter(kit)`.
  - Add `const category = searchParams.get('category') || ''`.
  - Change the where to:
```ts
    const where = {
      published: true,
      kind: { not: 'profile' },
      ...(category && isValidCategory(category) ? { category } : {}),
      ...searchFilter,
    }
```
  - Add `category: true` to the `select` so cards know their category.

- [ ] **Step 3: Build/tsc + curl smoke** (logged-in jar, a display id `DID`):
  - `PATCH {category:'sports'}` → 200; `PATCH {category:'bogus'}` → 400.
  - `PATCH {published:true, category:'sports'}`, then `GET /api/explore?category=sports` includes it and `?category=creative` excludes it.
- [ ] **Step 4: Commit**
```bash
git add "src/app/api/displays/[id]/route.ts" src/app/api/explore/route.ts
git commit -m "feat(explore): validate category on PATCH + explore category filter"
```

---

### Task 4: Publish dialog + editor wiring

**Files:** Create `src/components/editor/PublishDialog.tsx`; modify `src/components/editor/PageEditor.tsx`.

**Interfaces:** `<PublishDialog isOpen; onClose; displayId; currentCategory; currentCover; onPublished(category: string, coverImage: string | null) />` — requires a category, optional cover upload, `PATCH { published:true, category, coverImage }` on confirm.

- [ ] **Step 1: PublishDialog** (client) — modal (project pattern). Local `category` (seed `currentCategory`), `cover` (seed `currentCover`). Render a grid of `CATEGORIES` (single-select chips/cards, each with its lucide icon resolved from a small icon map), and a cover area: show `cover` (or a gradient placeholder) + an "Upload cover" label-input (`/api/upload` → `setCover(url)`). **Publish** button disabled unless `category`. On click:
```tsx
const res = await fetch(`/api/displays/${displayId}`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ published: true, category, coverImage: cover }),
})
if (res.ok) { onPublished(category, cover); onClose() }
```
Icon map (only the 8 used): `{ Trophy, Palette, Briefcase, Store, User, PartyPopper, GraduationCap, Sparkles }` from `lucide-react`.

- [ ] **Step 2: Editor state.** In `PageEditor.tsx`, add `const [category, setCategory] = useState<string | null>(null)`, `const [coverImage, setCoverImage] = useState<string | null>(null)`, `const [showPublishDialog, setShowPublishDialog] = useState(false)`. In `loadPage`, after `setPublished(data.published)`, add `setCategory(data.category ?? null)` and `setCoverImage(data.coverImage ?? null)`.

- [ ] **Step 3: Publish flow.** Replace `handlePublishToggle` so publishing opens the dialog, unpublishing toggles directly:
```tsx
  const handlePublishToggle = async () => {
    if (!id) return
    if (!published) {
      setShowPublishDialog(true)        // require category before going public
      return
    }
    setPublished(false)
    await fetch(`/api/displays/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ published: false }),
    })
  }
```
When already published, also let the button re-open the dialog to edit category/cover — acceptable: the Publish button calls `handlePublishToggle` (unpublish); add a separate small "Public settings" affordance is OUT OF SCOPE for A (the dialog is reachable by unpublish→publish). NOTE: keep it simple — publishing requires the dialog; editing category later happens by toggling.

- [ ] **Step 4: Render the dialog** near the other editor modals:
```tsx
{showPublishDialog && id && (
  <PublishDialog
    isOpen={showPublishDialog}
    onClose={() => setShowPublishDialog(false)}
    displayId={id}
    currentCategory={category}
    currentCover={coverImage}
    onPublished={(cat, cover) => { setPublished(true); setCategory(cat); setCoverImage(cover) }}
  />
)}
```
Import `PublishDialog`.

- [ ] **Step 5: tsc + manual check** — publishing an unpublished page opens the dialog; Publish is disabled until a category is chosen; choosing one (and optionally a cover) publishes and the toolbar shows "Published"; unpublish is one click.
- [ ] **Step 6: Commit**
```bash
git add src/components/editor/PublishDialog.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(explore): publish dialog requiring a category"
```

---

## Self-Review

**Spec coverage (Sub-project A):**
- Taxonomy in `src/lib/categories.ts` + `isValidCategory` tested → Task 2. ✅
- `Display.category` + index → Task 1. ✅
- `PATCH` accepts owner-only `category`, validates value (400) → Task 3. ✅
- Explore `category` filter replacing kit → Task 3. ✅
- Publish dialog requires category, cover encouraged; editor wiring → Task 4. ✅
- Unpublish stays one-click → Task 4 Step 3. ✅

**Placeholder scan:** Task 4's dialog is specified at assembly level (modal pattern + the exact PATCH body + icon map + disabled rule) rather than full JSX — a conscious altitude choice; the data contract and wiring are fully defined.

**Type consistency:** `isValidCategory(id)` used identically in Tasks 2/3. `category: string` / `coverImage: string | null` consistent across PublishDialog props, `onPublished`, and the editor state. `category` added to both the PATCH known-fields and the explore `select`.
