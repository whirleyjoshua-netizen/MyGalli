# PageHero Wave 2+3 Implementation Plan (6 pages)

**Goal:** Migrate Workspaces, Library, Data, Settings, Bulletin, Responses onto the shared `PageHero`, converging the last of the divergent headers (Home + Explore are a separate Wave 4).

**Approach:** Controller-direct edits (mechanical applications of the proven `PageHero` pattern from Wave 1), tsc-verified per page, one Opus whole-branch review + authoritative lint (eslint direct, `root:true` workaround) before merge. Branch `feat/page-chrome-w23` off `origin/main`.

## Global constraints
- `PageHero` owns top padding `px-6 lg:px-8 py-7` + the tab container. Pages pass tab BUTTONS in the canonical style: `px-5 py-3 text-sm font-medium transition-colors border-b-2 ${active?'border-primary text-foreground':'border-transparent text-muted-foreground hover:text-foreground'}`.
- Content that followed the old header is re-wrapped so it keeps its horizontal padding / max-width (PageHero now owns the top padding). Preserve all logic, state, data, modals, and interactions verbatim — header markup only.
- One banner asset (`/page-banner.png`) — inside `PageHero`, unchanged. Do NOT reference `workspaces-pond-banner.png` anywhere after this wave.
- No schema/API/dependency changes.

## Task 1 — `PageHero`: make tabs slot scroll-safe
`src/components/dashboard/PageHero.tsx`: change the tabs container `className` from `relative z-10 mt-6 flex gap-0 border-b border-border` to `relative z-10 mt-6 flex gap-0 border-b border-border overflow-x-auto scrollbar-hide` (so Data's 4 tabs scroll on narrow screens instead of overflowing; no-op for 2-tab pages). PageHero test stays green.

## Task 2 — Workspaces (`src/components/workspaces/WorkspacesListClient.tsx`)
- Import `PageHero`. Replace the title/action row (`:49-60`) AND remove the full-width banner block (`:62-65`).
- `<PageHero icon={<Database className="w-7 h-7 text-primary" />} title="Workspaces" subtitle="Your data, organized." action={<button onClick={()=>setShowCreate(true)} …New workspace…/>} />` (drop the 🌿 emoji now that there's an icon; `Database` is already imported).
- Wrap the remaining content (`FeatureTour`, `TemplatesComingSoon`, the sections, in-section search/sort/toggle controls unchanged) in `<div className="px-6 lg:px-8">`. Outer becomes `<div className="pb-7">`. `CreateWorkspaceModal` stays.
- No tabs (search/sort/toggle stay in-section). Retire the `Image` import + `/workspaces-pond-banner.png` reference if now unused.

## Task 3 — Library (`src/components/library/LibraryClient.tsx`)
- Import `PageHero`. Replace `<header>` (`:92-95`) + the tab `<div>` (`:97-111`).
- `<PageHero icon={<Library className="w-7 h-7 text-primary" />} title="Library" subtitle="Apps, templates, and kits to build your pages." tabs={TABS.map(t => <button key={t.id} onClick={()=>setTab(t.id)} className={canonical(tab===t.id)}>{t.label}</button>)} />` (convert the absolute-span underline to the canonical `border-b-2` style).
- Wrap the content below in `<div className="mx-auto max-w-7xl px-4 sm:px-8 pb-8">`; outer `<div>` becomes a plain fragment/`<div>`.

## Task 4 — Data (`src/app/(dashboard)/data/page.tsx`)
- Import `PageHero`. Remove the entire bordered `<header>` (`:137-214`).
- `<PageHero icon={<BarChart3 className="w-7 h-7 text-primary" />} title="Data" controls={<select value={selectedDisplayId||''} onChange=… the display selector …/>} tabs={[Overview, Elements(Inbox), Bulletin(Megaphone), Messages(Mail)] as canonical border-b-2 buttons with their icons + whitespace-nowrap shrink-0} />`.
- Keep `<main className="max-w-6xl mx-auto px-6 py-8">` content verbatim. Outer stays `<div className="min-h-screen bg-background">`.

## Task 5 — Settings (`src/app/(dashboard)/settings/page.tsx`)
- Import `Settings` from lucide + `PageHero`. Replace the outer `<div className="px-6 lg:px-8 py-7 max-w-xl">` open + the `<h1>Settings</h1>` (`:51-52`).
- `<PageHero icon={<Settings className="w-7 h-7 text-primary" />} title="Settings" />` then wrap the form content in `<div className="px-6 lg:px-8 max-w-xl">`. Outer `<div className="pb-7">`. Bottom Save button unchanged.

## Task 6 — Bulletin (`src/app/(dashboard)/bulletin/page.tsx`)
- Import `PageHero`. Replace the title block (`:8-14`).
- `<PageHero icon={<Megaphone className="w-7 h-7 text-primary" />} title="Bulletin" subtitle="Post updates for your followers, and see theirs." />` then `<div className="px-6 lg:px-8"><div className="max-w-2xl"><BulletinTab /></div></div>`. Outer `<div className="pb-7">`.

## Task 7 — Responses (`src/app/(dashboard)/responses/page.tsx`)
- Import `PageHero`. Remove the bordered `<header>` (`:164-202`).
- `<PageHero icon={<FileText className="w-7 h-7 text-primary" />} title="Form Responses" action={data && data.responses.length>0 ? <button onClick={exportToCSV}…Export CSV…/> : undefined} controls={<select … display selector (resets setPage(1)) …/>} />`.
- Keep `<main className="max-w-6xl mx-auto px-6 py-8">` verbatim. Outer stays `<div className="min-h-screen bg-background">`.

## Verify
- Per page: `pnpm exec tsc --noEmit` exit 0 (catches JSX imbalance / dropped content).
- Whole wave: Opus whole-branch review; authoritative eslint (root:true) 0 errors; existing scoped tests green (`workspaces`, `library` component tests).
- Then merge to main + push + verify Vercel deploy.
