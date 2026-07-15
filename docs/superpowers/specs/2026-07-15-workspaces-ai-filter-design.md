# Workspaces — Sub-project E: AI Over the Schema (Design)

**Date:** 2026-07-15
**Status:** Approved design (lead-authored), pre-implementation
**Depends on:** A (grid) + B (field types) + D (KPI) — live in prod. C (views/renderers) — built, local, unpushed on `workspaces-c-views`.

## Context
Locked decision #6 of the vision, and its endgame: *"show every student <90% attendance who plays football" → Workspace knows schema, AI queries JSONB, Display renders answer.*

E delivers that as **natural language → a saved filter on a view**. The user describes what they want; Claude translates it into a structured filter spec; our code executes that filter in Postgres and renders the matches through C's existing Grid/Gallery/Kanban renderers.

The AI is the thinnest layer in the stack. It converts English to a spec and nothing else — every step downstream is deterministic and unit-testable without an API key.

## Scope (lead call)
- **NL → filter spec.** One Claude call, schema-only input, structured output.
- **Filter saved on the view** (`WorkspaceView.config.filter`), so it re-runs live against new records.
- **Filter executes in Postgres**, before pagination, so totals are correct.
- **Interpreted filter always shown** to the user in plain language, with a remove action.
- **Free / ungated**, rate-limited.

Deferred: manual filter builder UI, sort, nested boolean logic, filters on public/shared pages, AI answering questions about record *contents*.

## Architecture

### Data flow
```
"soccer players with a fee over 1200"
  → POST /api/workspaces/[id]/filter-suggest   (auth + owner + rate limit)
  → Claude sees ONLY the field schema → FilterSpec
  → validateFilter(spec, fields)   ← never trust the model; 422 on violation
  → user confirms the plain-language interpretation
  → WorkspaceView.config.filter = spec        (persisted)
  → GET …/views/[viewId]/records → queryWorkspaceView step 4
  → filterToPrismaWhere(spec, fields) → Postgres matches, pre-pagination
  → C's GridView / GalleryView / KanbanView render the result
```

### The filter spec — flat by necessity
Structured outputs **do not support recursive JSON Schema**. Arbitrarily nested boolean logic cannot be schema-guaranteed, so the spec is one top-level `and`/`or` over flat conditions:

```ts
type Cmp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'is_empty' | 'is_not_empty'
type Condition = { field: string; cmp: Cmp; value?: string | number | boolean }
type FilterSpec = { op: 'and' | 'or'; conditions: Condition[] }
```

Covers "soccer players over $1,200" and "Tennis or Track". Does **not** cover `(A and B) or C`. Ship the honest limit rather than fake nesting the schema can't enforce.

Legal comparators per field type (enforced by `validateFilter`, not by the prompt):
- `text`/`url`/`email`: `eq`, `neq`, `contains`, `is_empty`, `is_not_empty`
- `number`/`currency`/`percent`/`rating`/`date`: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `is_empty`, `is_not_empty`
- `choice`: `eq`, `neq`, `is_empty`, `is_not_empty` (value must be one of the field's options)
- `checkbox`: `eq`, `neq`

### Trust boundary
Claude receives each field's `key`, `label`, `type`, and — for `choice` fields — its `options` (required to map "soccer" → `"Soccer"`). **No records are sent**, consistent with D's no-leak model.

Named plainly: choice options are schema config but are user-authored strings (team names, client names). This is a small, deliberate widening of D's boundary and the only one in E.

`validateFilter` is a **security control**, not just correctness — it is what prevents a hallucinated field name from reaching a JSONB path query. It must:
1. Reject any `field` not in the workspace's field list (422).
2. Reject any `cmp` illegal for that field's type (422).
3. Coerce `value` by field type before it reaches Prisma. This also fixes the real gotcha: `fee` stored as a JSON number will **not** match the string `"1200"`.

### API
- **`POST /api/workspaces/[id]/filter-suggest`** — new. Body `{ question: string }`. Auth + `authorizeWorkspace` + rate limit (`ws-filter-ai` prefix, ~10/min). Returns `{ filter: FilterSpec, summary: string }`. **Suggests only — never saves.** 422 when the model returns a spec that fails validation. 500 with a clear message when `ANTHROPIC_API_KEY` is unset (mirrors `/api/generate`).
- **`POST …/views`** — accept and validate `config.filter` via `validateFilter` (400 on invalid), alongside C's existing kanban/visibleFields validation.
- **`GET …/views/[viewId]/records`** — already exists, currently unused. E **activates** it; supersedes C's design note that it "stays unused".

Model: `claude-opus-4-8`, `output_config.format` with a raw JSON Schema (SDK 0.80 supports `output_config`; zod is not installed). Schema built per-workspace from its fields so the model can only name real fields.

### Libraries
- **`src/lib/workspaces/filter.ts`** (pure, TDD): `FilterSpec` types, `validateFilter(spec, fields)` → normalized spec or throws, `filterToPrismaWhere(spec, fields)` → Prisma `AND`/`OR` of JSONB `path` conditions, `describeFilter(spec, fields)` → plain-language string for the chips.
- **`src/lib/workspaces/filter-schema.ts`** (pure, TDD): `buildFilterJsonSchema(fields)` → the JSON Schema handed to `output_config.format`; `describeSchemaForPrompt(fields)` → the field list the model sees.
- **`src/lib/workspaces/query-view.ts`**: the filter lands in the open slot at step 4 (`// NOTE: Filtering and sorting logic would be built here incrementally as requested.`). Gets its first unit tests.

### Hook + UI
- **`useWorkspaceGrid`**: fetch records for the active view from `…/views/[viewId]/records`; refetch on view switch. Main `GET /api/workspaces/[id]` remains the source for workspace/fields/views.
  - **`GET /api/workspaces/[id]` keeps returning `records`** (unchanged response contract — D's KPI hydration and existing tests depend on the route's shape). After E the UI no longer reads that field; the hook reads records from the per-view endpoint. Do not remove it in E.
  - **Pin the page size to 100.** `queryWorkspaceView` currently defaults `pageSize = 25` while the main GET defaults to `100`. Switching the hook to the per-view endpoint without pinning this silently drops C's page size from 100 → 25. The per-view route must default to 100 to preserve current behavior.
- **`AddViewModal`**: adds a "Describe what you want to see" box → calls `filter-suggest` → renders the interpreted filter as plain-language chips for confirmation before the view is created.
- **`FilterChips`** (new, small): renders `describeFilter(spec, fields)` as chips (`Sport is Soccer · Fee > 1200`) on an active filtered view, with a remove-filter action.

## Testing
- **Pure helpers (TDD, no API key):** `validateFilter` accepts a good spec; rejects unknown field, illegal comparator for type, choice value not in options; coerces `"1200"` → `1200` for a number field. `filterToPrismaWhere` emits correct `AND`/`OR` JSONB path conditions. `describeFilter` renders labels not keys. `buildFilterJsonSchema` only enumerates real field keys.
- **`queryWorkspaceView` (new unit tests):** applies the view's filter to both `findMany` and `count`; a view with no filter behaves exactly as today.
- **Route:** `filter-suggest` — 401 unauth, 404 foreign workspace, 422 on a model spec naming an unknown field, 200 returns a validated filter (Anthropic client mocked — no live calls in CI).
- **Verify:** tsc/lint/full-suite green; browser smoke — describe a filter in plain English, confirm the chips match the intent, save it as a view, confirm only matching records render and the count is right.

## Risks
- **Cost is unguarded.** Free/ungated means the rate limiter is the only thing between a scripted client and the `ANTHROPIC_API_KEY`. Mitigated by: filters are *saved*, so steady-state cost is one call per view created, not per page load.
- **Model misreads intent.** Mitigated by never hiding the AI's decision: the interpreted filter is always shown as chips before save and while active.
- **No manual fallback in v1.** If the model can't express a query, the user has no other way to build a filter. Accepted for v1; the manual builder is the first follow-up.

## Out of scope
Manual filter builder, sort, nested `(A and B) or C` logic, AI over record *contents* (Q&A/summarization), AI-summary field type, filters on public/shared pages, cross-workspace queries. Also out of scope but worth a follow-up: `/api/generate` is pinned to the stale `claude-sonnet-4-20250514` and hand-parses JSON.

## Success criteria
On a workspace with a `choice` field and records, typing *"soccer players with a fee over 1200"* produces a filter the user can read in plain language, save as a named view, and see re-run live — rendering only matching records with a correct total, through C's existing renderers. No records are ever sent to Anthropic. tsc/lint/tests green.
