# Mobile page-editor toolbar — design

Date: 2026-07-04
Status: approved (user picked "Publish + ⋮ menu")

## Problem

The page editor's top `<header>` is a desktop toolbar with no mobile treatment.
Its right-hand action cluster (`flex flex-wrap justify-end`) holds Save status,
Preview, View Live, Presence, Collaborate, Share, and Publish. On a narrow
screen those wrap into a stacked, overflowing column that runs off the right
edge and crowds the title. (See the reported screenshot.)

## Goal

On mobile (`< md`), collapse the header to a single clean row:

```
[<-]  Untitled Page            [ Publish ]  [ ⋮ ]
```

- Back arrow + editable title on the left (title smaller on mobile).
- Primary **Publish** button stays visible (owner only).
- Everything else moves into a **⋮ overflow menu**: Save status, Preview,
  Share (owner), Collaborate, View Live (when published).

**Desktop (`md+`) is unchanged** — the existing full button row renders as today.

## Non-goals

- No change to any action's behavior, dialogs, or handlers.
- No change to the canvas, tabs, or the ControlPanel below the header.
- Presence avatars are not shown on mobile (collab-only, space-constrained).

## Design

### New component: `EditorActionsMenu`

`src/components/editor/EditorActionsMenu.tsx` — a small presentational overflow
menu. It owns only its own open/close state; all actions are passed in.

Props:
- `saving: boolean`, `lastSaved: Date | null` — renders a non-interactive
  status row (Saving… / ✓ Saved) at the top.
- `onPreview: () => void`
- `onShare?: () => void` — omitted → row hidden (non-owner)
- `onCollaborate?: () => void` — omitted → row hidden (no display id yet)
- `liveHref?: string` — present → "View Live" link (published pages)

Renders a kebab (`MoreVertical`) button; clicking toggles a dropdown (same
backdrop + absolute panel pattern used by `SidebarContent`'s user menu). Each
item invokes its handler and closes the menu.

Publish is intentionally NOT in this component — it stays a visible button.

### `PageEditor` header changes

- Existing right-cluster `div` gains `hidden md:flex` (desktop only, otherwise
  unchanged).
- New `flex md:hidden items-center gap-1.5` cluster:
  - `Publish` button (owner only) — reuses `handlePublishToggle`.
  - `<EditorActionsMenu>` wired to the existing handlers/state.
- Left container: `gap-2 md:gap-4`, `min-w-0`; title input
  `text-base md:text-xl` + truncate-friendly width so it no longer dominates.

## Testing

`EditorActionsMenu` unit tests (isolated, no PageEditor mount):
- Closed by default; kebab opens the dropdown.
- Shows "Saved" when `lastSaved` set, "Saving…" when `saving`.
- Preview row calls `onPreview` and closes.
- Share / Collaborate rows appear only when their handlers are provided.
- `liveHref` renders a "View Live" link with the right href.

## Files touched

- add `src/components/editor/EditorActionsMenu.tsx`
- add `src/components/editor/EditorActionsMenu.test.tsx`
- `src/components/editor/PageEditor.tsx` (header markup only)
