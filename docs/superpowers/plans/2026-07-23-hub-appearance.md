# Community Hub Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A community hub owner picks a colour theme in the builder, and the published hub renders in that theme.

**Architecture:** Six curated presets, each three HSL triples. `CommunityHubView` sets `--primary`, `--primary-foreground` and `--hub-accent` on its outermost element, which re-themes all 35 existing `primary` usages for free. Twelve hardcoded `galli` lines are converted by hand. Stored in `HubConfig` JSON — no schema change, no migration, no new endpoint.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, Vitest + Testing Library (`fireEvent` only — `@testing-library/user-event` is NOT installed).

**Spec:** `docs/superpowers/specs/2026-07-23-hub-appearance-design.md`. Read it first.

## Global Constraints

- **The `galli` preset must be a pixel no-op.** Its `primary` is `153 64% 53%`, copied verbatim from `--primary` in `src/app/globals.css`. Task 1 makes this a test. If that test ever fails, every live hub has been restyled.
- **Do not modify `KollabWordmark`.** Its comment states it deliberately mints a unique gradient per instance as a brand mark.
- **Do not change the Galli green's contrast.** White-on-galli is ~1.9:1 today. That is a separate decision about existing hubs; see the spec.
- **Scope the CSS variables to the hub wrapper**, never `:root` or a global stylesheet rule — the dashboard and top bar must be unaffected.
- **SEO & Sharing stays in "Coming soon."** Only Appearance moves out.
- Tests: `JWT_SECRET` set, `--maxWorkers=2`, `fireEvent` not `user-event`.
- PDF-adjacent smokes need `next build && next start`; `next dev` cannot load pdf.js through this worktree's symlinked `node_modules`.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/types/hub-config.ts` (modify) | `HUB_THEME_KEYS`, `HubThemeKey`, `appearance` on `HubConfig`, default `galli`. |
| `src/lib/hub-themes.ts` (create) | The preset table and `resolveHubTheme`. Pure — no React, no Tailwind. |
| `src/lib/hub-config.ts` (modify) | Sanitize `appearance.theme`, coercing unknown values to `galli`. |
| `tailwind.config.ts` (modify) | Add the `hub-accent` colour token. |
| `src/app/globals.css` (modify) | `--hub-accent` default in `:root` (today's galli-violet). |
| `src/components/hub/community/CommunityHubView.tsx` (modify) | Set the three variables on the wrapper; convert its own two `galli` usages. |
| `src/components/hub/community/*.tsx` (modify) | Convert the remaining 10 hardcoded `galli` lines. |
| `src/components/hub/builder/AppearanceSection.tsx` (create) | The swatch grid. |
| `src/components/hub/builder/HubBuilderNav.tsx` (modify) | Move Appearance from `SOON` to `ITEMS`. |
| `src/components/hub/builder/HubBuilder.tsx` (modify) | Render `AppearanceSection` for `section === 'appearance'`. |

---

### Task 1: Theme presets

**Files:**
- Modify: `src/lib/types/hub-config.ts`
- Create: `src/lib/hub-themes.ts`
- Test: `src/lib/hub-themes.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HUB_THEME_KEYS`, `HubThemeKey` (from `hub-config.ts`)
  - `export type HubTheme = { key: HubThemeKey; label: string; primary: string; primaryForeground: string; accent: string }`
  - `export const HUB_THEMES: HubTheme[]`
  - `export function resolveHubTheme(key: string | undefined): HubTheme`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/hub-themes.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { HUB_THEMES, resolveHubTheme } from './hub-themes'
import { HUB_THEME_KEYS } from './types/hub-config'

describe('HUB_THEMES', () => {
  it('covers every declared key exactly once', () => {
    expect(HUB_THEMES.map((t) => t.key).sort()).toEqual([...HUB_THEME_KEYS].sort())
  })

  it('gives every preset all three colours and a label', () => {
    for (const t of HUB_THEMES) {
      expect(t.label.length).toBeGreaterThan(0)
      for (const field of ['primary', 'primaryForeground', 'accent'] as const) {
        // HSL triple, e.g. "153 64% 53%" — the format the CSS vars already use
        expect(t[field]).toMatch(/^\d{1,3} \d{1,3}% \d{1,3}%$/)
      }
    }
  })

  it('keeps the galli preset identical to the live --primary in globals.css', () => {
    // THE regression guard for "existing hubs render unchanged". If this fails,
    // shipping would silently restyle every hub that never picked a theme.
    const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
    const live = css.match(/--primary:\s*([^;]+);/)![1].trim()
    expect(resolveHubTheme('galli').primary).toBe(live)
  })
})

describe('resolveHubTheme', () => {
  it('returns the requested preset', () => {
    expect(resolveHubTheme('sunset').key).toBe('sunset')
  })

  it('falls back to galli for unknown, empty or undefined keys', () => {
    expect(resolveHubTheme('nonsense').key).toBe('galli')
    expect(resolveHubTheme('').key).toBe('galli')
    expect(resolveHubTheme(undefined).key).toBe('galli')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-themes.test.ts`
Expected: FAIL — cannot resolve `./hub-themes`

- [ ] **Step 3: Add the keys to the config types**

In `src/lib/types/hub-config.ts`, above `HubConfig`:

```ts
export const HUB_THEME_KEYS = ['galli', 'ocean', 'sunset', 'violet', 'slate', 'rose'] as const
export type HubThemeKey = (typeof HUB_THEME_KEYS)[number]
```

Add to the `HubConfig` type:

```ts
  appearance: { theme: HubThemeKey }
```

and to `DEFAULT_HUB_CONFIG`:

```ts
  appearance: { theme: 'galli' },
```

- [ ] **Step 4: Write the preset table**

```ts
// src/lib/hub-themes.ts
import { HUB_THEME_KEYS, type HubThemeKey } from './types/hub-config'

export type HubTheme = {
  key: HubThemeKey
  label: string
  /** HSL triples — the format --primary already uses in globals.css. */
  primary: string
  primaryForeground: string
  /** Second stop for the placeholder gradients (cover, avatars, page cards). */
  accent: string
}

// `galli` reproduces today's values exactly: primary is copied from --primary in
// globals.css and accent is the HSL of the galli-violet hex. That is what makes
// the default a visual no-op for every hub that never picks a theme.
export const HUB_THEMES: HubTheme[] = [
  { key: 'galli',  label: 'Galli Green', primary: '153 64% 53%', primaryForeground: '0 0% 100%', accent: '245 100% 69%' },
  { key: 'ocean',  label: 'Ocean',       primary: '199 89% 48%', primaryForeground: '0 0% 100%', accent: '217 91% 60%' },
  { key: 'sunset', label: 'Sunset',      primary: '21 90% 48%',  primaryForeground: '0 0% 100%', accent: '340 82% 52%' },
  { key: 'violet', label: 'Violet',      primary: '258 90% 58%', primaryForeground: '0 0% 100%', accent: '330 81% 60%' },
  { key: 'slate',  label: 'Slate',       primary: '215 25% 27%', primaryForeground: '0 0% 100%', accent: '215 20% 65%' },
  { key: 'rose',   label: 'Rose',        primary: '347 77% 50%', primaryForeground: '0 0% 100%', accent: '24 95% 53%' },
]

const BY_KEY = new Map(HUB_THEMES.map((t) => [t.key, t]))

/** Never throws: an unknown key renders as Galli rather than breaking the page. */
export function resolveHubTheme(key: string | undefined): HubTheme {
  return BY_KEY.get(key as HubThemeKey) ?? BY_KEY.get('galli')!
}

export function isHubThemeKey(v: unknown): v is HubThemeKey {
  return typeof v === 'string' && (HUB_THEME_KEYS as readonly string[]).includes(v)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-themes.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/hub-themes.ts src/lib/hub-themes.test.ts src/lib/types/hub-config.ts
git commit -m "feat(hub): theme presets for community hubs"
```

---

### Task 2: Sanitize the new config key

**Files:**
- Modify: `src/lib/hub-config.ts`
- Test: `src/lib/hub-config.test.ts` (append; create if absent)

**Interfaces:**
- Consumes: `isHubThemeKey` (Task 1).
- Produces: `sanitizeHubConfig` now always returns `appearance: { theme: HubThemeKey }`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/hub-config.test.ts
import { sanitizeHubConfig } from './hub-config'

describe('sanitizeHubConfig appearance', () => {
  it('defaults a config with no appearance key to galli', () => {
    // Every hub created before themes existed takes this path.
    expect(sanitizeHubConfig({}).appearance).toEqual({ theme: 'galli' })
  })

  it('keeps a valid theme', () => {
    expect(sanitizeHubConfig({ appearance: { theme: 'sunset' } }).appearance.theme).toBe('sunset')
  })

  it('coerces an unknown theme to galli rather than passing it through', () => {
    expect(sanitizeHubConfig({ appearance: { theme: 'neon-chartreuse' } }).appearance.theme).toBe('galli')
  })

  it('survives a non-object appearance', () => {
    expect(sanitizeHubConfig({ appearance: 'nope' }).appearance.theme).toBe('galli')
    expect(sanitizeHubConfig({ appearance: null }).appearance.theme).toBe('galli')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-config.test.ts`
Expected: FAIL — `appearance` is undefined

- [ ] **Step 3: Implement**

Add the import:

```ts
import { isHubThemeKey } from './hub-themes'
```

Before the `return`:

```ts
  const appearanceRaw = (r.appearance && typeof r.appearance === 'object' ? r.appearance : {}) as Record<string, any>
  const theme = isHubThemeKey(appearanceRaw.theme) ? appearanceRaw.theme : 'galli'
```

Add to the returned object:

```ts
    appearance: { theme },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/hub-config.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/hub-config.ts src/lib/hub-config.test.ts
git commit -m "feat(hub): sanitize the appearance theme key"
```

---

### Task 3: The hub-accent Tailwind token

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: the `hub-accent` class colour (`bg-hub-accent`, `to-hub-accent`, …).

- [ ] **Step 1: Add the token**

In `tailwind.config.ts`, inside `colors`, beside `galli`:

```ts
        'hub-accent': 'hsl(var(--hub-accent))',
```

- [ ] **Step 2: Add the root default**

In `src/app/globals.css`, in the same `:root` block as `--primary`:

```css
    --hub-accent: 245 100% 69%;       /* galli-violet — hub theme accent default */
```

The default matches today's `galli-violet`, so any use outside a themed hub wrapper looks unchanged.

- [ ] **Step 3: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && npx next build`
Expected: `Compiled successfully`. (Tailwind fails the build on a malformed colour value, so a green build is the check here.)

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat(hub): hub-accent colour token for theme gradients"
```

---

### Task 4: Apply the theme in CommunityHubView

**Files:**
- Modify: `src/components/hub/community/CommunityHubView.tsx`
- Test: `src/components/hub/community/CommunityHubView.test.tsx` (append)

**Interfaces:**
- Consumes: `resolveHubTheme` (Task 1).
- Produces: no prop change — the theme is read from `config.appearance.theme`.

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/components/hub/community/CommunityHubView.test.tsx
import { resolveHubTheme } from '@/lib/hub-themes'

describe('CommunityHubView theming', () => {
  const styleOf = (container: HTMLElement) => (container.firstElementChild as HTMLElement).style

  it('sets the three theme variables on its outermost element', () => {
    const config = { ...DEFAULT_HUB_CONFIG, appearance: { theme: 'sunset' as const } }
    const { container } = render(<CommunityHubView {...base} config={config} />)
    const s = styleOf(container)
    const t = resolveHubTheme('sunset')
    expect(s.getPropertyValue('--primary')).toBe(t.primary)
    expect(s.getPropertyValue('--primary-foreground')).toBe(t.primaryForeground)
    expect(s.getPropertyValue('--hub-accent')).toBe(t.accent)
  })

  it('falls back to galli when the config has no appearance key', () => {
    // Mirrors every hub created before themes existed.
    const { appearance, ...noAppearance } = DEFAULT_HUB_CONFIG as any
    const { container } = render(<CommunityHubView {...base} config={noAppearance} />)
    expect(styleOf(container).getPropertyValue('--primary')).toBe(resolveHubTheme('galli').primary)
  })

  it('does not set the variables on document root', () => {
    // Scoping matters: a hub theme must never leak into the dashboard chrome.
    render(<CommunityHubView {...base} />)
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('')
  })
})
```

Note `base` and `DEFAULT_HUB_CONFIG` already exist in this file; the `Suspense` wrapper means `container.firstElementChild` is the themed div.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/CommunityHubView.test.tsx`
Expected: FAIL — the variables are empty strings.

- [ ] **Step 3: Implement**

Add the import:

```tsx
import { resolveHubTheme } from '@/lib/hub-themes'
```

Inside `CommunityHubViewInner`, before the return:

```tsx
  const theme = resolveHubTheme(config.appearance?.theme)
```

Note the optional chain: a caller may pass a config object assembled in a test or an older cached payload without the key.

Replace the outermost element, converting its two `galli` usages at the same time:

```tsx
    <div
      className="min-h-screen bg-gradient-to-b from-primary/5 to-transparent"
      style={{
        '--primary': theme.primary,
        '--primary-foreground': theme.primaryForeground,
        '--hub-accent': theme.accent,
      } as React.CSSProperties}
    >
```

and the footer strip:

```tsx
        <div className="mt-10 rounded-2xl border border-border bg-primary/5 py-6 text-center text-sm text-muted-foreground">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/community/`
Expected: PASS — all community suites.

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/community/CommunityHubView.tsx src/components/hub/community/CommunityHubView.test.tsx
git commit -m "feat(hub): apply the selected theme to the community hub"
```

---

### Task 5: Convert the remaining hardcoded galli usages

**Files:**
- Modify: `src/components/hub/community/CommunityHeader.tsx`
- Modify: `src/components/hub/community/HubAnnouncementComposer.tsx`
- Modify: `src/components/hub/community/HubAnnouncementBanner.tsx`
- Modify: `src/components/hub/community/CommunitySidebar.tsx`
- Modify: `src/components/hub/community/HubPagesTab.tsx`

**Interfaces:** none — pure class substitution.

Ten lines. Each is a mechanical swap; the list is exhaustive, so afterwards the only `galli` left in `src/components/hub/community` is the comment in `KollabWordmark`.

- [ ] **Step 1: CommunityHeader (4 lines)**

- L35 cover placeholder: `from-galli/30 to-galli-violet/30` → `from-primary/30 to-hub-accent/30`
- L48 avatar placeholder: same substitution
- L65 Edit button: `bg-galli px-4 py-2 text-sm font-semibold text-white` → `bg-primary … text-primary-foreground`
- L68 Join button: `bg-galli text-white` → `bg-primary text-primary-foreground`

- [ ] **Step 2: HubAnnouncementComposer (1 line)**

- L51 Post button: `bg-galli … text-white` → `bg-primary … text-primary-foreground`

- [ ] **Step 3: HubAnnouncementBanner (1 line)**

- L53: `border-galli/30 bg-galli/5` → `border-primary/30 bg-primary/5`

- [ ] **Step 4: CommunitySidebar (3 lines)**

- L48 and L113 avatar placeholders: `from-galli/30 to-galli-violet/30` → `from-primary/30 to-hub-accent/30`
- L157 icon tile: `bg-galli/10 text-primary` → `bg-primary/10 text-primary`

- [ ] **Step 5: HubPagesTab (1 line)**

- L135 page-card placeholder: `from-galli/20 to-galli-aqua/10` → `from-primary/20 to-hub-accent/10`

- [ ] **Step 6: Verify the conversion is complete**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
grep -rn "galli" src/components/hub/community --include="*.tsx" | grep -v test
```
Expected: exactly one line — the comment in `KollabWordmark.tsx`. Anything else is a missed conversion.

Then:
```bash
JWT_SECRET=test-secret npx vitest run src/components/hub/community/ && npx tsc --noEmit -p tsconfig.json
```
Expected: PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/hub/community
git commit -m "feat(hub): make community accents follow the hub theme"
```

---

### Task 6: The Appearance settings section

**Files:**
- Create: `src/components/hub/builder/AppearanceSection.tsx`
- Test: `src/components/hub/builder/AppearanceSection.test.tsx`

**Interfaces:**
- Consumes: `HUB_THEMES` (Task 1); `HubConfig`.
- Produces: `export function AppearanceSection({ config, onChange }: { config: HubConfig; onChange: (c: HubConfig) => void })` — the same signature as `CommunitySettingsSection`, so `HubBuilder` wires it identically.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/hub/builder/AppearanceSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AppearanceSection } from './AppearanceSection'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'
import { HUB_THEMES } from '@/lib/hub-themes'

describe('AppearanceSection', () => {
  it('offers every preset', () => {
    render(<AppearanceSection config={DEFAULT_HUB_CONFIG} onChange={() => {}} />)
    for (const t of HUB_THEMES) {
      expect(screen.getByRole('button', { name: new RegExp(t.label, 'i') })).toBeInTheDocument()
    }
  })

  it('marks the active preset', () => {
    const config = { ...DEFAULT_HUB_CONFIG, appearance: { theme: 'ocean' as const } }
    render(<AppearanceSection config={config} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /ocean/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /sunset/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the chosen theme without disturbing the rest of the config', () => {
    const onChange = vi.fn()
    render(<AppearanceSection config={DEFAULT_HUB_CONFIG} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /sunset/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_HUB_CONFIG, appearance: { theme: 'sunset' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/builder/AppearanceSection.test.tsx`
Expected: FAIL — cannot resolve `./AppearanceSection`

- [ ] **Step 3: Implement**

```tsx
// src/components/hub/builder/AppearanceSection.tsx
'use client'

import type { HubConfig } from '@/lib/types/hub-config'
import { HUB_THEMES } from '@/lib/hub-themes'

export function AppearanceSection({
  config, onChange,
}: {
  config: HubConfig
  onChange: (c: HubConfig) => void
}) {
  const active = config.appearance?.theme ?? 'galli'

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-lg font-bold">Appearance</h2>
      <p className="text-sm text-muted-foreground">Pick a colour theme for your hub.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {HUB_THEMES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={t.key === active}
            onClick={() => onChange({ ...config, appearance: { theme: t.key } })}
            className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
              t.key === active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'
            }`}
          >
            <span className="flex shrink-0 -space-x-1.5" aria-hidden="true">
              <span className="h-6 w-6 rounded-full border-2 border-surface" style={{ backgroundColor: `hsl(${t.primary})` }} />
              <span className="h-6 w-6 rounded-full border-2 border-surface" style={{ backgroundColor: `hsl(${t.accent})` }} />
            </span>
            <span className="text-sm font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        The theme applies to your hub&apos;s public page, including its Files and Pages tabs.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/builder/AppearanceSection.test.tsx`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/hub/builder/AppearanceSection.tsx src/components/hub/builder/AppearanceSection.test.tsx
git commit -m "feat(hub): Appearance settings section with theme swatches"
```

---

### Task 7: Turn the nav entry on

**Files:**
- Modify: `src/components/hub/builder/HubBuilderNav.tsx`
- Modify: `src/components/hub/builder/HubBuilder.tsx`
- Test: `src/components/hub/builder/HubBuilderNav.test.tsx` (create)

**Interfaces:**
- Consumes: `AppearanceSection` (Task 6).
- Produces: `BuilderSection` gains `'appearance'`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/hub/builder/HubBuilderNav.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubBuilderNav } from './HubBuilderNav'

describe('HubBuilderNav', () => {
  it('offers Appearance as a real, selectable section', () => {
    const onSelect = vi.fn()
    render(<HubBuilderNav active="settings" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    expect(onSelect).toHaveBeenCalledWith('appearance')
  })

  it('still lists SEO & Sharing as coming soon, not as a button', () => {
    // Only Appearance graduates in this change.
    render(<HubBuilderNav active="settings" onSelect={() => {}} />)
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /seo/i })).not.toBeInTheDocument()
    expect(screen.getByText(/seo & sharing/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/builder/HubBuilderNav.test.tsx`
Expected: FAIL — no Appearance button (it is a `div` in `SOON`).

- [ ] **Step 3: Move the entry**

In `HubBuilderNav.tsx`, add `'appearance'` to the `BuilderSection` union, add to `ITEMS` after `profile`:

```ts
  { key: 'appearance', label: 'Appearance', sub: 'Themes, colors & visuals', icon: Palette, enabled: true },
```

and reduce `SOON` to SEO only:

```ts
const SOON: { label: string; sub: string; icon: any }[] = [
  { label: 'SEO & Sharing', sub: 'Optimize & share', icon: Search },
]
```

- [ ] **Step 4: Render the section**

In `HubBuilder.tsx`, import `AppearanceSection` and add beside the other sections:

```tsx
          {section === 'appearance' && <AppearanceSection config={config} onChange={setConfig} />}
```

- [ ] **Step 5: Verify**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/hub/builder/ && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/hub/builder
git commit -m "feat(hub): graduate Appearance out of Coming soon"
```

---

### Task 8: Whole-feature verification

- [ ] **Step 1: Static gates**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
npx tsc --noEmit -p tsconfig.json                 # exit 0
npx next lint --dir src                            # 0 errors
JWT_SECRET=test-secret npx vitest run --maxWorkers=2
npx next build                                     # Compiled successfully
```

Note: `src/app/api/messages/upload/route.test.ts` fails on `main` already and is unrelated to this work. Confirm it is the only failure; do not "fix" it here.

- [ ] **Step 2: Confirm the default is a no-op**

With the seeded `smoke-community` hub left on its default config, capture the published page before and after this branch and compare the rendered accent colours. The `galli` preset test in Task 1 is the mechanical guard; this is the visual one.

- [ ] **Step 3: Browser smoke** (production build — `next build && next start`)

- Owner opens the builder, selects **Appearance**, and the swatch grid renders six presets with the current one marked.
- Selecting **Sunset** updates the builder preview immediately.
- Saving, then loading the published hub, shows: orange Join/Edit buttons, orange-tinted announcement banner, orange→pink placeholder gradients.
- The Kollab wordmark is unchanged in both themes.
- A hub with no `appearance` key still renders Galli green.

- [ ] **Step 4: Ship**

Merge to `main` (auto-deploys). No migration in this feature — the config is JSON and the sanitizer supplies the default.
