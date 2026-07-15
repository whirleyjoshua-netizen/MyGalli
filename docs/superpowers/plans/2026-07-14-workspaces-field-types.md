# Workspaces Field Types (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** Add 5 field types (`currency`, `percent`, `rating`, `url`, `email`) to Workspaces — validator coercion, a pure display formatter, grid cell editors/renderers, column-editor options, and make the new numeric types aggregatable by the KPI element.

**Architecture:** Extend the existing seams from A/D — no new models, no migration. `currency/percent/rating` store numbers; `url/email` store strings. Branch `workspaces-b-fieldtypes` off current `main`.

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest.

## Global Constraints
- New type strings (verbatim): `currency`, `percent`, `rating`, `url`, `email`.
- `currency/percent/rating` = numbers; `rating` clamped `0..max` (config.max ?? 5), integer. `url/email` = strings, lenient (never hard-reject a save).
- Config: `currency {symbol?}` (default `$`), `rating {max?}` (default 5). percent/url/email: none.
- Reuse `safeHref` (`src/lib/editor/safe-href.ts`) for url/email link rendering; email → `mailto:`.
- Never commit: Documents/, Images/, g1t.json, nul, .claude/.
- tsc + lint + tests must pass.

**Design ref:** `docs/superpowers/specs/2026-07-14-workspaces-field-types-design.md`

---

### Task 1: Validator cases + pure formatter (TDD)

**Files:**
- Modify: `src/lib/workspace-validator.ts`
- Modify: `src/lib/workspace-validator.test.ts`
- Create: `src/lib/workspaces/format-value.ts`
- Test: `src/lib/workspaces/format-value.test.ts`

**Interfaces:**
- Produces: validator handles the 5 new types; `formatFieldValue(type: string, value: any, config?: any): string`.

- [ ] **Step 1: Write failing validator tests** — append to `src/lib/workspace-validator.test.ts`:
```ts
  it('coerces currency and percent to numbers', () => {
    const f = (type: string): any => [{ id: '1', workspaceId: 'w', key: 'v', label: 'V', type, required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() }]
    expect(validateWorkspaceRecord(f('currency'), { v: '12.5' }).data).toEqual({ v: 12.5 })
    expect(validateWorkspaceRecord(f('percent'), { v: 95 }).data).toEqual({ v: 95 })
  })
  it('clamps + rounds rating to 0..max', () => {
    const f: any = [{ id: '1', workspaceId: 'w', key: 'r', label: 'R', type: 'rating', required: false, position: 0, config: { max: 5 }, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() }]
    expect(validateWorkspaceRecord(f, { r: 9 }).data).toEqual({ r: 5 })
    expect(validateWorkspaceRecord(f, { r: -2 }).data).toEqual({ r: 0 })
    expect(validateWorkspaceRecord(f, { r: 3.7 }).data).toEqual({ r: 4 })
  })
  it('stores url/email as strings', () => {
    const f = (type: string): any => [{ id: '1', workspaceId: 'w', key: 'v', label: 'V', type, required: false, position: 0, config: null, validation: null, defaultValue: null, createdAt: new Date(), updatedAt: new Date() }]
    expect(validateWorkspaceRecord(f('url'), { v: 'example.com' }).data).toEqual({ v: 'example.com' })
    expect(validateWorkspaceRecord(f('email'), { v: 'a@b.com' }).data).toEqual({ v: 'a@b.com' })
  })
```

- [ ] **Step 2: Run → fail.** `npx vitest run src/lib/workspace-validator.test.ts`

- [ ] **Step 3: Add validator cases.** In `src/lib/workspace-validator.ts`, inside the `switch (field.type)`, add before `default:`:
```ts
        case 'currency':
        case 'percent': {
          const n = Number(rawValue)
          if (isNaN(n)) throw new Error('Must be a number')
          data[field.key] = n
          break
        }
        case 'rating': {
          const n = Number(rawValue)
          if (isNaN(n)) throw new Error('Must be a number')
          const max = (field.config as { max?: number })?.max ?? 5
          data[field.key] = Math.max(0, Math.min(max, Math.round(n)))
          break
        }
        case 'url':
        case 'email':
          data[field.key] = String(rawValue)
          break
```

- [ ] **Step 4: Run → pass.** `npx vitest run src/lib/workspace-validator.test.ts`

- [ ] **Step 5: Write formatter test** — `src/lib/workspaces/format-value.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { formatFieldValue } from './format-value'

describe('formatFieldValue', () => {
  it('formats currency with symbol + thousands', () => {
    expect(formatFieldValue('currency', 1234.5, { symbol: '$' })).toBe('$1,234.5')
    expect(formatFieldValue('currency', 10, {})).toBe('$10')
  })
  it('formats percent', () => { expect(formatFieldValue('percent', 95)).toBe('95%') })
  it('passes through text/number/url', () => {
    expect(formatFieldValue('number', 42)).toBe('42')
    expect(formatFieldValue('url', 'x.com')).toBe('x.com')
  })
  it('empty/null -> empty string', () => {
    expect(formatFieldValue('currency', null)).toBe('')
    expect(formatFieldValue('text', '')).toBe('')
  })
})
```

- [ ] **Step 6: Run → fail**, then implement `src/lib/workspaces/format-value.ts`:
```ts
export function formatFieldValue(type: string, value: any, config?: any): string {
  if (value === null || value === undefined || value === '') return ''
  switch (type) {
    case 'currency': {
      const symbol = config?.symbol ?? '$'
      const n = Number(value)
      return isNaN(n) ? String(value) : `${symbol}${n.toLocaleString('en-US')}`
    }
    case 'percent':
      return `${value}%`
    case 'date':
      return new Date(value).toLocaleDateString()
    default:
      return String(value)
  }
}
```

- [ ] **Step 7: Run → pass.** `npx vitest run src/lib/workspaces/format-value.test.ts`

- [ ] **Step 8: Commit.**
```bash
git add src/lib/workspace-validator.ts src/lib/workspace-validator.test.ts src/lib/workspaces/format-value.ts src/lib/workspaces/format-value.test.ts
git commit -m "feat(workspaces): validator + formatter for currency/percent/rating/url/email"
```

---

### Task 2: GridCell — render + edit the new types (TDD)

**Files:**
- Modify: `src/components/workspaces/cells/GridCell.tsx`
- Modify: `src/components/workspaces/cells/GridCell.test.tsx`

**Interfaces:** Consumes `formatFieldValue` (Task 1) + `safeHref`. GridCell handles the 5 new types in display + edit.

- [ ] **Step 1: Write failing tests** — append to `GridCell.test.tsx`:
```tsx
  it('renders a url as a safe new-tab link', () => {
    const onCommit = vi.fn()
    render(<GridCell field={field('url') as any} value="https://example.com" onCommit={onCommit} />)
    const a = screen.getByRole('link') as HTMLAnchorElement
    expect(a.href).toContain('example.com')
    expect(a.target).toBe('_blank')
  })
  it('rating commits the clicked star value', () => {
    const onCommit = vi.fn()
    render(<GridCell field={{ id: 'f', key: 'k', label: 'L', type: 'rating', position: 0, config: { max: 5 } } as any} value={0} onCommit={onCommit} />)
    const stars = screen.getAllByRole('button')
    fireEvent.click(stars[2]) // 3rd star
    expect(onCommit).toHaveBeenCalledWith(3)
  })
  it('formats currency in display', () => {
    render(<GridCell field={{ id: 'f', key: 'k', label: 'L', type: 'currency', position: 0, config: { symbol: '$' } } as any} value={1200} onCommit={vi.fn()} />)
    expect(screen.getByText('$1,200')).toBeInTheDocument()
  })
```
(Ensure the existing `field(type)` helper covers these; the `field('url')` helper already exists in the file.)

- [ ] **Step 2: Run → fail.** `npx vitest run src/components/workspaces/cells/GridCell.test.tsx`

- [ ] **Step 3: Implement.** In `GridCell.tsx`:
  - Import: `import { formatFieldValue } from '@/lib/workspaces/format-value'` and `import { safeHref } from '@/lib/editor/safe-href'`.
  - **Rating** (immediate-commit, like checkbox) — add near the top, after the checkbox early-return:
    ```tsx
    if (field.type === 'rating') {
      const max = field.config?.max ?? 5
      const cur = Number(value) || 0
      return (
        <div className="flex gap-0.5">
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onClick={() => onCommit(n === cur ? null : n)}
              className={n <= cur ? 'text-galli' : 'text-muted-foreground/40'}>★</button>
          ))}
        </div>
      )
    }
    ```
  - **Display mode** (the `!editing` branch): replace the display div's content so url/email render as links and currency/percent use the formatter:
    ```tsx
    if (!editing) {
      const display = (() => {
        if (value === null || value === undefined || value === '') return ''
        if (field.type === 'url') return <a href={safeHref(String(value))} target="_blank" rel="noopener noreferrer" className="text-galli underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
        if (field.type === 'email') return <a href={`mailto:${String(value)}`} className="text-galli underline" onClick={(e) => e.stopPropagation()}>{String(value)}</a>
        return formatFieldValue(field.type, value, field.config)
      })()
      return (
        <div data-testid="cell-display" onClick={() => { setDraft(field.type === 'date' ? toInputDate(value) : (value ?? '')); setEditing(true) }} className="min-h-[1.5rem] cursor-text">
          {display}
        </div>
      )
    }
    ```
  - **Edit mode** input type: extend the `inputType` line:
    ```tsx
    const inputType = (field.type === 'number' || field.type === 'currency' || field.type === 'percent') ? 'number'
      : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'
    ```
  - Keep the existing `formatDisplay` helper for any remaining callers, but the display branch above supersedes it. (You may delete `formatDisplay` if now unused — confirm no other reference in the file.)

- [ ] **Step 4: Run → pass**, then `npx vitest run src/components/workspaces src/lib/workspaces` (green) + `npx tsc --noEmit 2>&1 | grep -iE 'GridCell|workspace' || echo clean`.

- [ ] **Step 5: Commit.**
```bash
git add src/components/workspaces/cells/GridCell.tsx src/components/workspaces/cells/GridCell.test.tsx
git commit -m "feat(workspaces): grid cells for currency/percent/rating/url/email"
```

---

### Task 3: Column editor types + config + KPI aggregatable filter

**Files:**
- Modify: `src/components/workspaces/ColumnEditorPopover.tsx`
- Modify: `src/components/elements/WorkspaceKpiElement.tsx`

- [ ] **Step 1: Add the 5 types + config to ColumnEditorPopover.** In `TYPES`, append:
```ts
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' },
  { value: 'rating', label: 'Rating' },
  { value: 'url', label: 'Link' },
  { value: 'email', label: 'Email' },
```
Add config state + inputs. After `const [optionsText, setOptionsText] = useState('')`:
```ts
  const [symbol, setSymbol] = useState('$')
  const [ratingMax, setRatingMax] = useState(5)
```
Extend `submit()` to build config per type:
```ts
    let config: any = undefined
    if (type === 'choice') config = { options: optionsText.split('\n').map((s) => s.trim()).filter(Boolean) }
    else if (type === 'currency') config = { symbol: symbol.trim() || '$' }
    else if (type === 'rating') config = { max: Math.max(1, Math.min(10, ratingMax || 5)) }
    onSubmit(label.trim(), type, config)
```
Add the conditional inputs next to the choice textarea:
```tsx
        {type === 'currency' && (
          <input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="Symbol (e.g. $)" maxLength={3}
            className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2" />
        )}
        {type === 'rating' && (
          <input type="number" min={1} max={10} value={ratingMax} onChange={(e) => setRatingMax(parseInt(e.target.value) || 5)}
            placeholder="Max stars" className="mb-3 w-full rounded-lg border border-border bg-transparent px-3 py-2" />
        )}
```

- [ ] **Step 2: Broaden the KPI aggregatable-field filter.** In `src/components/elements/WorkspaceKpiElement.tsx`, find the field-picker filter `fields.filter((f) => f.type === 'number')` and change to:
```tsx
              {fields.filter((f) => ['number', 'currency', 'percent', 'rating'].includes(f.type)).map(...)}
```
(Keep the rest of that `<select>` as-is.)

- [ ] **Step 3: Verify.**
```bash
npx tsc --noEmit 2>&1 | grep -iE 'ColumnEditor|WorkspaceKpi|workspace' || echo clean
npx next lint 2>&1 | grep -iE 'ColumnEditor|WorkspaceKpi|Error:' || echo "no lint errors"
npx vitest run src/components/workspaces src/components/elements/PublicWorkspaceKpiElement.test.tsx src/lib/workspaces
```
Expected: no tsc/lint output; tests green.

- [ ] **Step 4: Commit.**
```bash
git add src/components/workspaces/ColumnEditorPopover.tsx src/components/elements/WorkspaceKpiElement.tsx
git commit -m "feat(workspaces): column-editor types+config, KPI aggregates new numeric types"
```

---

### Task 4: Verify + PR
- [ ] Full gate: `npx tsc --noEmit` (0), `npx next lint` (no errors), `npx vitest run` (only the pre-existing failures — none here, main is green now).
- [ ] Push `workspaces-b-fieldtypes`; open PR (base main): summary of the 5 new types, no migration, KPI now aggregates currency/percent/rating.

## Out of scope
tags/multi-select, relationship, formula, file, AI. Hard url/email validation. Currency decimals/locale config.
