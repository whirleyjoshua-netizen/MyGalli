# PageHero Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared `PageHero` component (one banner, top-right bleed) and migrate Gallery + My Pond onto it, retiring the bespoke `PondHero`.

**Architecture:** One new presentational component `src/components/dashboard/PageHero.tsx` renders an icon+title+subtitle header with optional `action`/`controls`/`tabs` slots and a single decorative banner (`/page-banner.png`) bleeding into the top-right behind a left→right fade. Gallery and My Pond replace their hand-rolled headers with `<PageHero>`; all page state/data/logic below the header is untouched.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind (semantic tokens), `next/image`, lucide-react, Vitest + @testing-library/react.

## Global Constraints
- **Layout = top-right bleed** (spec `2026-07-18-page-hero-design-system-design.md`): banner absolute, right-anchored, `object-cover object-right`, `hidden md:block`; left→right gradient overlay `from-background via-background/90 to-transparent` above the image; foreground content `relative z-10`. Banner is decorative → `alt=""` + `aria-hidden`.
- **One asset only:** `/page-banner.png`. No per-page art. Do not reference `workspaces-pond-banner.png` or `pond/hero-sign.png` from `PageHero`.
- **Semantic tokens only** — `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`/`text-white`. No hard-coded hex.
- **No schema / API / dependency changes.** Pure presentational refactor. Do not change data fetching, `useMemo`/`useEffect`, tab STATE, card components, or modal logic on either page — only the header markup and (My Pond) the removal of `PondHero`.
- **Lint gates the prod build:** escape apostrophes in JSX (`&apos;`), use `next/link` not `<a>` for internal nav (not expected here), no unused imports. Run `pnpm exec next lint` before declaring done.
- **Tabs live in the `PageHero` `tabs` slot** and use ONE canonical style (defined in Task 1). Gallery's old `gap-1 px-4` and My Pond's old `gap-0 px-5` tab bars are both replaced by the standardized style — the pages pass tab BUTTONS, `PageHero` owns the container.
- **Work in the worktree:** `cd` into `.claude/worktrees/page-chrome` first; verify `git branch --show-current` → `feat/page-chrome` before every commit. Use absolute worktree paths.
- **Env for any prisma/test command:** none needed (UI only). Tests run via `pnpm exec vitest run <files>`.

---

### Task 1: `PageHero` component + banner asset

**Files:**
- Create: `src/components/dashboard/PageHero.tsx`
- Create: `src/components/dashboard/PageHero.test.tsx`
- Asset: `public/page-banner.png` — **already placed in the worktree by the controller** (a wide pond landscape placeholder). Confirm it exists (`ls public/page-banner.png`); do NOT regenerate it. Commit it with this task.

**Interfaces:**
- Produces: `export function PageHero(props: PageHeroProps)` and `export type PageHeroProps`, consumed by Tasks 2 & 3:
  ```ts
  export type PageHeroProps = {
    icon: React.ReactNode
    title: string
    subtitle?: string
    action?: React.ReactNode
    controls?: React.ReactNode
    tabs?: React.ReactNode
  }
  ```
- Produces the canonical tab style (documented for Tasks 2 & 3): each tab is a `<button>` with
  `className={\`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}\`}`. `PageHero` renders `tabs` inside `<div className="relative z-10 flex gap-0 border-b border-border">`.

- [ ] **Step 1: Write the failing test**

`src/components/dashboard/PageHero.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { PageHero } from './PageHero'
import { ImageIcon } from 'lucide-react'

describe('PageHero', () => {
  it('renders title, subtitle, and icon', () => {
    render(<PageHero icon={<ImageIcon data-testid="hero-icon" />} title="Gallery" subtitle="Your pages and boards." />)
    expect(screen.getByRole('heading', { name: /Gallery/ })).toBeInTheDocument()
    expect(screen.getByText('Your pages and boards.')).toBeInTheDocument()
    expect(screen.getByTestId('hero-icon')).toBeInTheDocument()
  })

  it('renders action, controls, and tabs slots when provided', () => {
    render(
      <PageHero
        icon={<span />} title="X"
        action={<button>New page</button>}
        controls={<button>Grid</button>}
        tabs={<button>Pages</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'New page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grid' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument()
  })

  it('omits optional slots when not provided and has a decorative banner', () => {
    const { container } = render(<PageHero icon={<span />} title="Only Title" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // decorative banner image present with empty alt
    const img = container.querySelector('img[alt=""]')
    expect(img).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/dashboard/PageHero.test.tsx`
Expected: FAIL — `Cannot find module './PageHero'`.

- [ ] **Step 3: Confirm the banner asset exists**

Run: `ls -la public/page-banner.png`
Expected: the file exists (placed by the controller). If missing, STOP and report NEEDS_CONTEXT.

- [ ] **Step 4: Write the component**

`src/components/dashboard/PageHero.tsx`:
```tsx
import Image from 'next/image'

export type PageHeroProps = {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  controls?: React.ReactNode
  tabs?: React.ReactNode
}

export function PageHero({ icon, title, subtitle, action, controls, tabs }: PageHeroProps) {
  return (
    <div className="relative overflow-hidden px-6 lg:px-8 py-7">
      {/* Decorative banner — bleeds into the top-right, faded on the left */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-3/5 md:block" aria-hidden="true">
        <Image
          src="/page-banner.png"
          alt=""
          fill
          priority
          sizes="60vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
      </div>

      {/* Header row */}
      <div className="relative z-10 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {icon} {title}
          </h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {(controls || action) && (
          <div className="flex items-center gap-2 shrink-0">
            {controls}
            {action}
          </div>
        )}
      </div>

      {/* Tabs slot */}
      {tabs && <div className="relative z-10 mt-6 flex gap-0 border-b border-border">{tabs}</div>}
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/dashboard/PageHero.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm exec tsc --noEmit` (expect exit 0) and `pnpm exec next lint` (expect no new errors in the changed files).

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/PageHero.tsx src/components/dashboard/PageHero.test.tsx public/page-banner.png
git commit -m "feat(dashboard): PageHero shared header with top-right banner bleed"
```

---

### Task 2: Migrate Gallery (`/my-pages`) to `PageHero`

**Files:**
- Modify: `src/app/(dashboard)/my-pages/page.tsx` (header block `:145-182` — the outer `<div className="px-6 lg:px-8 py-7">`, the title/button row `:147-167`, and the tabs `:169-182`)

**Interfaces:**
- Consumes: `PageHero` + `PageHeroProps` from Task 1 (canonical tab style documented there).

- [ ] **Step 1: Add imports**

At top of `my-pages/page.tsx`, add `Image as ImageIcon` to the lucide import and import `PageHero`:
```tsx
import { Plus, Globe, FileEdit, Image as ImageIcon } from 'lucide-react'
import { PageHero } from '@/components/dashboard/PageHero'
```
(`ImageIcon` is the Gallery icon. If `Image` name collides with anything, alias remains `ImageIcon`.)

- [ ] **Step 2: Replace the header + tabs markup**

Replace the opening `<div className="px-6 lg:px-8 py-7">` header block (the title/action row at `:147-167` AND the tabs `<div>` at `:169-182`) so the page returns:
```tsx
  return (
    <div className="pb-7">
      <PageHero
        icon={<ImageIcon className="w-7 h-7 text-primary" />}
        title="Gallery"
        subtitle="Your pages and boards — live and in progress."
        action={
          activeTab === 'boards' ? (
            <button
              onClick={createBoard}
              className="inline-flex shrink-0 items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New board
            </button>
          ) : (
            <button
              onClick={() => router.push('/editor')}
              className="inline-flex shrink-0 items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full font-semibold shadow-soft hover:brightness-105 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> New page
            </button>
          )
        }
        tabs={([['pages', 'Pages', pageCount], ['boards', 'Boards', boardCount]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        ))}
      />

      <div className="px-6 lg:px-8">
        {/* existing content below the tabs: loading / empty / published+drafts sections */}
```
**Important:** the content that followed the old tabs (`loading ? … : activeList.length === 0 ? … : <div className="space-y-10">…`) must now be wrapped in the `<div className="px-6 lg:px-8">` shown above (since `PageHero` owns the top padding but the content still needs horizontal padding). Preserve every child unchanged; only re-wrap. Close the extra wrapper `</div>` before the final page-level `</div>`.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm exec tsc --noEmit` (exit 0) and `pnpm exec next lint` (no new errors).

- [ ] **Step 4: Run existing Gallery tests (if any) + full type build**

Run: `pnpm exec vitest run src/app/\(dashboard\)/my-pages 2>/dev/null || echo "no page-level tests — tsc is the gate"`
Expected: PASS or "no page-level tests". `tsc` from Step 3 is the hard gate.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/my-pages/page.tsx"
git commit -m "feat(gallery): adopt shared PageHero header"
```

---

### Task 3: Migrate My Pond (`/shared`) to `PageHero`, retire `PondHero`

**Files:**
- Modify: `src/app/(dashboard)/shared/page.tsx` (imports; header `:71-72`; tabs `:74-87`)
- Delete: `src/components/pond/PondHero.tsx`

**Interfaces:**
- Consumes: `PageHero` from Task 1.
- Reuses unchanged: `PondToolbar`, `PondWelcomeBanner`, `CommunityCard`, `CollabCard`, `GetMoreCard`, `NewCommunityModal`, and the `lib/pond` helpers. The view-toggle (grid/list) and "New community" button move from `PondHero` into `PageHero`'s `controls`/`action`.

- [ ] **Step 1: Update imports**

In `shared/page.tsx`: remove `import { PondHero } from '@/components/pond/PondHero'`; add `import { PageHero } from '@/components/dashboard/PageHero'`; add the icons the toggle needs to the lucide import — change `import { Users } from 'lucide-react'` to `import { Users, LayoutGrid, List, Plus } from 'lucide-react'`.

- [ ] **Step 2: Replace `PondHero` usage + tabs with `PageHero`**

Replace the outer `<div className="px-6 lg:px-8 py-7">` opening, the `<PondHero … />` line (`:72`), and the tabs `<div>` (`:74-87`) so the render becomes:
```tsx
  return (
    <div className="pb-7">
      <PageHero
        icon={<Users className="w-7 h-7 text-primary" />}
        title="My Pond"
        subtitle="Communities you&apos;ve joined and pages you collaborate on."
        controls={
          <div className="flex items-center rounded-xl border border-border overflow-hidden">
            <button aria-label="Grid view" onClick={() => setViewPersist('grid')} className={`p-2 ${view === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><LayoutGrid className="w-4 h-4" /></button>
            <button aria-label="List view" onClick={() => setViewPersist('list')} className={`p-2 ${view === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}><List className="w-4 h-4" /></button>
          </div>
        }
        action={
          <button onClick={() => setNewOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl hover:bg-primary/90">
            <Plus className="w-4 h-4" /> New community
          </button>
        }
        tabs={([['communities', 'Communities', communities.length], ['collabs', 'Collabs', collabs.length]] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === key ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label} <span className="font-normal text-muted-foreground">({count})</span>
          </button>
        ))}
      />

      <div className="px-6 lg:px-8">
        {!welcomeDismissed && <PondWelcomeBanner onDismiss={dismissWelcome} />}

        <PondToolbar
          query={query} onQuery={setQuery}
          filter={filter} onFilter={setFilter}
          sort={sort} onSort={setSort}
          showFilter={isCommunities}
          searchPlaceholder={isCommunities ? 'Search communities...' : 'Search pages...'}
        />

        {/* existing <div className="flex gap-6"> … main + aside … unchanged */}
        {/* NewCommunityModal stays at the end */}
      </div>
    </div>
  )
```
Preserve the `flex gap-6` main/aside block, the `NewCommunityModal`, and the helper components (`CardGrid`, `EmptyState`) verbatim — only re-wrap them in the new `<div className="px-6 lg:px-8">` and close it before the outer `</div>`.

- [ ] **Step 3: Delete `PondHero.tsx`**

Run: `git rm src/components/pond/PondHero.tsx`
Confirm no other file imports it: `grep -rn "PondHero" src/ | grep -v PondWelcomeBanner` → expect no matches.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm exec tsc --noEmit` (exit 0) and `pnpm exec next lint` (no new errors — watch the `&apos;` in the subtitle).

- [ ] **Step 5: Run pond component tests (unaffected but confirm)**

Run: `pnpm exec vitest run src/components/pond`
Expected: PASS (PondToolbar/PondWelcomeBanner/CommunityCard/NewCommunityModal tests unchanged and green; PondHero had no test).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/shared/page.tsx"
git commit -m "feat(pond): adopt shared PageHero, retire bespoke PondHero"
```

---

## Self-Review (controller, after plan is written)
- **Spec coverage:** Wave 1 scope = build `PageHero` + Gallery + My Pond + retire `PondHero`. Tasks 1/2/3 cover each. ✓
- **Type consistency:** `PageHeroProps` defined in Task 1 is used identically in Tasks 2 & 3 (`icon`/`title`/`subtitle`/`action`/`controls`/`tabs`). Canonical tab style repeated verbatim in all three. ✓
- **No placeholders:** every step has concrete code/commands. Banner asset placed by controller before dispatch. ✓
- **Verification:** each task ends with tsc + lint + scoped tests + commit. ✓
