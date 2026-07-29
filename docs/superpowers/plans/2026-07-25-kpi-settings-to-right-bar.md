# KPI Settings → Right Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move a KPI element's configuration into the right-column `KPIInspector` and delete the redundant on-card settings gear. Reference implementation for migrating config-type elements.

**Architecture:** The inspector receives the raw `element` and an `onChange` writing `Partial<CanvasElement>`, so it edits the **stored** `kpi*` fields directly. The `KPIElement` component uses translated prop names (`label`, `value`, …); `ColumnCanvas` bridges the two. Only three files change; no type or data changes.

**Tech Stack:** Next.js 15, React 19, Tailwind, Vitest + Testing Library (`fireEvent` only — no `user-event`).

**Spec:** `docs/superpowers/specs/2026-07-25-kpi-settings-to-right-bar-design.md`. Read it first.

## Global Constraints

- **The inspector writes stored field names** — `kpiLabel`, `kpiValue`, `kpiPrefix`, `kpiSuffix`, `kpiTrend`, `kpiTrendValue`, `kpiColor` — NOT the component prop names (`label`, `value`, …). This is the opposite layer from the `KPIElement` component. Confirmed: `ColumnCanvas` maps `element.kpiLabel → label` prop and `updates.label → kpiLabel` on write.
- **There is no bug to fix.** The existing 2-field inspector and `starter-inspectors.test.tsx` (asserting `{ kpiLabel }`) are correct — the inspector is only incomplete. Do not "fix" that test.
- **KPI only.** No other element, no `TextStylePanel` styling gears, no auto-expand-on-select.
- Tests: `JWT_SECRET` set, `--maxWorkers=2`, `fireEvent` not `user-event`.
- Browser smoke needs `next build && next start`.

## File Structure

| File | Change |
|---|---|
| `src/components/elements/KPIElement.tsx` | `export` `COLOR_THEMES`; delete gear button, floating panel, `showSettings`, now-unused imports. |
| `src/components/editor/panel/inspectors/KPIInspector.tsx` | Rewrite to the full config over `kpi*` fields. |
| `src/components/editor/panel/inspectors/KPIInspector.test.tsx` (create) | Cover every field. |

---

### Task 1: Export COLOR_THEMES and trim the KPI card

**Files:**
- Modify: `src/components/elements/KPIElement.tsx`

**Interfaces:**
- Produces: `export const COLOR_THEMES` (keys `blue`/`green`/`red`/`purple`/`orange`/`slate`), consumed by Task 2.

- [ ] **Step 1: Export COLOR_THEMES**

Change `const COLOR_THEMES = {` (line ~28) to `export const COLOR_THEMES = {`.

- [ ] **Step 2: Delete the gear button**

In the `{isSelected && (…)}` Controls block, delete the entire first `<button>` (the one whose `onClick` calls `setShowSettings(!showSettings)` and renders `<Settings … />`). Keep the second button (the `onDelete` / `<Trash2 …>` one). The row goes from `[⚙][🗑]` to `[🗑]`.

- [ ] **Step 3: Delete the floating Settings Panel**

Delete the whole `{showSettings && isSelected && ( … )}` block (the `absolute top-full … w-72 …` panel containing Prefix/Suffix/Trend/Trend Value/Color).

- [ ] **Step 4: Delete state and now-unused imports**

- Delete `const [showSettings, setShowSettings] = useState(false)`.
- `useState` is now unused (it was only for `showSettings`) → remove `import { useState } from 'react'`.
- `Settings` and `X` are now unused → remove them from the `lucide-react` import, leaving `Trash2, TrendingUp, TrendingDown, Minus`.

- [ ] **Step 5: Verify it compiles and nothing else regressed**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
npx tsc --noEmit -p tsconfig.json          # exit 0 — catches any missed unused import / stray showSettings ref
grep -n "showSettings\|<Settings\|COLOR_THEMES" src/components/elements/KPIElement.tsx
```
Expected: tsc exit 0; grep shows `export const COLOR_THEMES` and the `theme = COLOR_THEMES[color]` use, and **zero** `showSettings` / `<Settings` hits.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/KPIElement.tsx
git commit -m "feat(editor): drop the on-card KPI settings gear; export COLOR_THEMES"
```

---

### Task 2: Rewrite KPIInspector with the full config

**Files:**
- Modify: `src/components/editor/panel/inspectors/KPIInspector.tsx`
- Test: `src/components/editor/panel/inspectors/KPIInspector.test.tsx` (create)

**Interfaces:**
- Consumes: `COLOR_THEMES` (Task 1); `InspectorProps` from `./DefaultInspector` (`{ element, onChange, isPro }`).
- Produces: no signature change — still `export function KPIInspector({ element, onChange }: InspectorProps)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/inspectors/KPIInspector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KPIInspector } from './KPIInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'kpi',
  kpiLabel: 'Revenue', kpiValue: '42', kpiPrefix: '$', kpiSuffix: '%',
  kpiTrend: 'neutral', kpiTrendValue: '', kpiColor: 'blue',
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<KPIInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('KPIInspector', () => {
  it('edits label → kpiLabel', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/^label$/i), { target: { value: 'Sales' } })
    expect(onChange).toHaveBeenCalledWith({ kpiLabel: 'Sales' })
  })

  it('edits value → kpiValue', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/^value$/i), { target: { value: '99' } })
    expect(onChange).toHaveBeenCalledWith({ kpiValue: '99' })
  })

  it('edits prefix and suffix', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/prefix/i), { target: { value: '€' } })
    fireEvent.change(screen.getByLabelText(/suffix/i), { target: { value: 'k' } })
    expect(onChange).toHaveBeenCalledWith({ kpiPrefix: '€' })
    expect(onChange).toHaveBeenCalledWith({ kpiSuffix: 'k' })
  })

  it('sets trend direction', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /up/i }))
    expect(onChange).toHaveBeenCalledWith({ kpiTrend: 'up' })
  })

  it('edits trend text → kpiTrendValue', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/trend text/i), { target: { value: '+12%' } })
    expect(onChange).toHaveBeenCalledWith({ kpiTrendValue: '+12%' })
  })

  it('picks a colour → kpiColor', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /green/i }))
    expect(onChange).toHaveBeenCalledWith({ kpiColor: 'green' })
  })

  it('marks the active trend and colour from the element', () => {
    setup({ kpiTrend: 'down', kpiColor: 'purple' })
    expect(screen.getByRole('button', { name: /down/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /purple/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/editor/panel/inspectors/KPIInspector.test.tsx`
Expected: FAIL — current inspector has only Label/Value and no `kpiValue`/prefix/trend/colour controls.

- [ ] **Step 3: Rewrite the inspector**

```tsx
// src/components/editor/panel/inspectors/KPIInspector.tsx
'use client'
import type { InspectorProps } from './DefaultInspector'
import { COLOR_THEMES } from '@/components/elements/KPIElement'

const TRENDS = [
  { id: 'up' as const, label: 'Up' },
  { id: 'neutral' as const, label: 'None' },
  { id: 'down' as const, label: 'Down' },
]

export function KPIInspector({ element, onChange }: InspectorProps) {
  const trend = element.kpiTrend ?? 'neutral'
  const color = element.kpiColor ?? 'blue'
  const field = 'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Label
        <input type="text" value={element.kpiLabel ?? ''} className={field}
          onChange={(e) => onChange({ kpiLabel: e.target.value })} />
      </label>

      <label className="block text-xs text-muted-foreground">
        Value
        <input type="text" value={element.kpiValue ?? ''} className={field}
          onChange={(e) => onChange({ kpiValue: e.target.value })} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs text-muted-foreground">
          Prefix
          <input type="text" value={element.kpiPrefix ?? ''} placeholder="$" className={field}
            onChange={(e) => onChange({ kpiPrefix: e.target.value })} />
        </label>
        <label className="block text-xs text-muted-foreground">
          Suffix
          <input type="text" value={element.kpiSuffix ?? ''} placeholder="%" className={field}
            onChange={(e) => onChange({ kpiSuffix: e.target.value })} />
        </label>
      </div>

      <div className="text-xs text-muted-foreground">
        Trend
        <div className="mt-1 flex gap-1">
          {TRENDS.map((t) => (
            <button key={t.id} type="button" aria-pressed={trend === t.id}
              onClick={() => onChange({ kpiTrend: t.id })}
              className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition ${
                trend === t.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block text-xs text-muted-foreground">
        Trend text
        <input type="text" value={element.kpiTrendValue ?? ''} placeholder="+12% from last month" className={field}
          onChange={(e) => onChange({ kpiTrendValue: e.target.value })} />
      </label>

      <div className="text-xs text-muted-foreground">
        Colour
        <div className="mt-1 flex gap-2">
          {(Object.keys(COLOR_THEMES) as Array<keyof typeof COLOR_THEMES>).map((c) => (
            <button key={c} type="button" aria-label={c} aria-pressed={color === c}
              onClick={() => onChange({ kpiColor: c })}
              className={`w-7 h-7 rounded-full bg-gradient-to-br ${COLOR_THEMES[c].gradient} transition ${
                color === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
              }`} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

Note: the `aria-label={c}` on each swatch is what makes `getByRole('button', { name: /green/i })` work; the color keys (`blue`…`slate`) are the accessible names.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/editor/panel/inspectors/KPIInspector.test.tsx`
Expected: PASS — 7 tests.

- [ ] **Step 5: Confirm the pre-existing starter test still passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/editor/panel/inspectors/starter-inspectors.test.tsx`
Expected: PASS unchanged — its KPI case still finds a Label input and asserts `{ kpiLabel: 'Revenue' }`.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/panel/inspectors/KPIInspector.tsx src/components/editor/panel/inspectors/KPIInspector.test.tsx
git commit -m "feat(editor): full KPI config in the right-bar inspector"
```

---

### Task 3: Whole-feature verification

- [ ] **Step 1: Static gates**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
npx tsc --noEmit -p tsconfig.json                 # exit 0
npx next lint --dir src                            # 0 errors
JWT_SECRET=test-secret npx vitest run --maxWorkers=2
npx next build                                     # Compiled successfully
```

Note: `src/app/api/messages/upload/route.test.ts` fails on `main` already and is unrelated. Confirm it is the only failure; do not fix it here.

- [ ] **Step 2: Browser smoke** (production build — `next build && next start`)

Seed or insert a KPI element, then in the editor:
- Select the KPI card → it shows only the delete control, **no** gear; no floating "KPI Settings" panel appears.
- Open the right **Elements** tab, expand the KPI row → the inspector shows Label, Value, Prefix, Suffix, Trend (Up/None/Down), Trend text, Colour swatches.
- In the inspector: set Trend = Up and click a colour → the card updates live (badge appears, theme colour changes).
- Type into the KPI value inline on the card → still editable, updates live.

- [ ] **Step 3: Ship**

Push the branch and open a PR against `main` (do **not** merge directly — workflow constraint). Report the PR URL / compare link.
