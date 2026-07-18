# Community Hub M2 — The Hub Builder — Design

**Date:** 2026-07-17
**Status:** Approved (design)
**Base:** `main` @ `4d837cd` (M1 live in prod). Branch `feat/community-m2` (isolated worktree `.claude/worktrees/community-m2`).
**Program spec:** `docs/superpowers/specs/2026-07-17-community-hub-builder-design.md` (M1–M4 roadmap). This is **M2**.

## Context & goal
M1 shipped a themed public community page whose layout is **hardcoded** (always: feed + Members + Resources + Video), and owners configure only a few fields via the old data-room `HubEditor`. M2 delivers the **Hub Builder** from the owner-editing mockup: a dedicated editor with a left settings nav, an **embedded live preview**, and a live-autosaved config that drives the public page — so owners can toggle/reorder what appears and control member access.

### Decisions (confirmed with user)
- **Live-edit + publish toggle** (not draft/publish staging): one live `Hub.config` JSON, **autosaved** (mirrors how `Display`/pages already work — single config + `published` boolean, version-based optimistic concurrency). Publish/Unpublish = the M1 visibility toggle. The "unsaved changes" bar tracks in-flight edits before autosave, not a draft copy.
- **Embedded live preview** with a desktop/mobile width toggle (renders the real `CommunityHubView` from the in-progress config).
- **Shell + 4 sections**: Hub Settings, Layout & Sections, Hub Profile, Community Settings. Appearance / Widgets & Tools / SEO appear in the nav **disabled ("coming soon")** — their features are M3/M4.
- Keep the existing files/notes management as-is and reachable (it's the content behind the Resources widget) — not redesigned into the builder now.
- The one real Community-Settings behavior in M2 is **who-can-post**; join-approval/moderation stays C2.

## Reuse map (confirmed in code)
- `Display` precedent (`prisma/schema.prisma:167`): single config JSON (`sections`/`background`/`tabs`) + `published` + `version`; **no draft/published content split**. Editor `src/components/editor/PageEditor.tsx` autosaves via PATCH with `version` optimistic concurrency (409 on conflict), tracks `lastSavedPayloadRef`/`lastSaved`.
- M1 public page `src/components/hub/community/CommunityHubView.tsx` (+ `CommunityHeader`/`CommunityFeed`/`CommunitySidebar`) — currently takes explicit props; M2 makes it **config-driven**.
- Public page `src/app/[username]/hub/[slug]/page.tsx` already fetches members/resources/counts and branches on `hub.community` → `CommunityHubView`.
- Participation gate `canParticipate` in `src/lib/community.ts`; posts POST `src/app/api/hubs/[id]/posts/route.ts`.
- Current owner surface `src/components/hub/HubEditor.tsx` (`/hubs/[id]` via `src/app/(dashboard)/hubs/[id]/page.tsx`) — data-room grid; PATCH allowlist in `src/app/api/hubs/[id]/route.ts` (title/description/coverImage/community/published/tagline/heroVideoUrl).

## M2 requirements

### R1 — Config data model (one additive migration)
- `Hub.config Json?` — the live layout/feed/access config. `null` ⇒ use the **default config** (below), so existing communities render exactly as M1.
- `Hub.version Int @default(0)` — optimistic concurrency for autosave.
- Typed `HubConfig` (in `src/lib/types/hub-config.ts`):
  ```ts
  type HubSidebarWidget = { key: 'members' | 'resources' | 'video'; enabled: boolean }
  type HubConfig = {
    sidebar: HubSidebarWidget[]            // order = render order; enabled toggles visibility
    feed: { composerEnabled: boolean; loadMoreEnabled: boolean; emptyStateText?: string }
    access: { whoCanPost: 'members' | 'owner-only' }
  }
  ```
- `DEFAULT_HUB_CONFIG` (all widgets enabled, order `[members, resources, video]`, `composerEnabled:true`, `loadMoreEnabled:true`, `whoCanPost:'members'`) — the M1 behavior.
- **`sanitizeHubConfig(raw): HubConfig`** (pure, unit-tested) — coerces/validates any stored-or-posted value into a valid `HubConfig` (known widget keys only, dedup, booleans, enum for `whoCanPost`, string cap on `emptyStateText`), always returning a safe config. Applied on both write (PATCH) and read (server page) so a malformed payload can never break the public render.

### R2 — PATCH accepts config + version
Extend `PATCH /api/hubs/[id]`: accept `config` (run through `sanitizeHubConfig`) and `version` (optimistic — if provided and `!= hub.version`, return **409**; on success bump `version`). Keep the existing field allowlist. Owner/collaborator only (existing `ownHub`).

### R3 — The Builder (`HubBuilder` + parts)
The page component `src/app/(dashboard)/hubs/[id]/page.tsx` branches: `hub.community` → `HubBuilder`; otherwise the existing data-room `HubEditor` (unchanged). **File/note management stays reachable** for community hubs via a "Manage files & links" link in the Layout & Sections → Resources area that opens the current data-room grid (existing `HubEditor`, e.g. at `/hubs/[id]?tab=files` or a dedicated `/hubs/[id]/files`) — the data-room UI itself is not redesigned in M2. Components under `src/components/hub/builder/`:
- **`HubBuilder`** — shell: top bar (Back to My Galli · "Editing: {title}" + Published pill · Preview link · Publish/Unpublish · ⋮), left `HubBuilderNav`, main panel (switches on active section), right `HubBuilderPreview`, bottom `HubBuilderSaveBar` (unsaved / "Last saved …"). Holds working config + hub-fields state.
- **`useHubAutosave(hubId, payload, version)`** — debounced PATCH, dirty/lastSaved tracking, 409 → reload latest + notify. Mirrors `PageEditor`'s save discipline.
- **Sections** (main panel): `HubSettingsSection` (published status + community toggle + basics), `LayoutSectionsSection` (drag-reorder + enable/disable sidebar widgets; feed settings: composer, load-more, empty-state text), `HubProfileSection` (name/tagline/avatar/username-URL — existing PATCH fields), `CommunitySettingsSection` (who-can-post). Nav also lists **Appearance / Widgets & Tools / SEO as disabled** items.
- **`HubBuilderPreview`** — renders the real `CommunityHubView` from the in-progress (unsaved) config, with a desktop/mobile width toggle. Preview is read-only (interactions no-op or open the live page).

### R4 — Config-driven public page
Refactor `CommunityHubView` (+ `CommunitySidebar`, `CommunityFeed`) to take `config: HubConfig` and:
- render sidebar widgets in `config.sidebar` order, skipping `enabled:false`;
- honor `config.feed` (composer visibility, load-more, empty-state text).
The server page passes `sanitizeHubConfig(hub.config)` (falling back to default) plus the data it already fetches. Default fallback guarantees no regression for existing/unconfigured communities.

### R5 — who-can-post enforcement
`config.access.whoCanPost` gates posting **server-side** in `posts` POST: `'members'` = current `canParticipate`; `'owner-only'` = owner/collaborators only (members keep read/react/comment). The `CommunityFeed` composer visibility follows the same rule client-side. A tiny pure helper `canPostWithAccess(base: canParticipate result, whoCanPost, isPrivileged)` keeps the rule in one place (unit-tested).

## Components (new / changed)
- **New**: `src/lib/types/hub-config.ts` (types + `DEFAULT_HUB_CONFIG`), `src/lib/hub-config.ts` (`sanitizeHubConfig`, `canPostWithAccess`), `src/components/hub/builder/*` (`HubBuilder`, `HubBuilderNav`, `HubBuilderPreview`, `HubBuilderSaveBar`, `HubSettingsSection`, `LayoutSectionsSection`, `HubProfileSection`, `CommunitySettingsSection`), `src/hooks/useHubAutosave.ts`.
- **Changed**: `prisma/schema.prisma` (`Hub.config`, `Hub.version`), `src/app/api/hubs/[id]/route.ts` (PATCH config+version+409), `src/app/(dashboard)/hubs/[id]/page.tsx` or `HubEditor` entry (branch community→builder), `src/components/hub/community/{CommunityHubView,CommunitySidebar,CommunityFeed}.tsx` (config-driven), `src/app/[username]/hub/[slug]/page.tsx` (pass config), `src/app/api/hubs/[id]/posts/route.ts` (who-can-post gate).

## Non-goals (M3/M4/C2)
Appearance/theming, Widgets & Tools (utility strip, Kollab AI, Tools), Upcoming Events, SEO/custom-URL/verified badge, true draft/publish staging, join-approval/moderation, redesigning file/note management.

## Verification
- **Unit**: `sanitizeHubConfig` (unknown keys stripped, dedup, enum coercion, default fallback), config-driven sidebar order/skip (pure), `canPostWithAccess`, PATCH config+version 409 path, posts POST owner-only gate.
- **E2E** (real login + fresh DB): open builder on a community → disable a sidebar widget + reorder + set `owner-only` → autosave (PATCH 200, version bumps) → public page reflects order/toggles and a member's post is 403 → preview panel reflects edits live.
- **Static**: `tsc --noEmit`, `next lint`, `pnpm test`.

## Open follow-ups (not M2)
- Multi-editor (Pro collaborator) real-time conflict UX beyond 409-reload.
- Migrating the disabled nav items (Appearance/Widgets/SEO) into real sections (M3/M4).
