export interface SaveGateState {
  /** Row id being edited. Comes off the URL, so it is set before the load finishes. */
  id: string | null
  /** A PATCH is already in flight. */
  saving: boolean
  /** A previous save lost a version race; the user must resolve it. */
  conflict: boolean
  /**
   * We have actually seen what the server holds — either loadPage() returned,
   * or we created the row ourselves this session.
   */
  hasLoaded: boolean
}

/**
 * Whether the editor is allowed to write to the server.
 *
 * `hasLoaded` is the load-bearing one. `id` is set at mount from the URL, so
 * the 5s autosave used to fire while the initial GET was still in flight and
 * PATCH the editor's blank default state over a real document — title reset to
 * "Untitled Page", sections emptied.
 *
 * It only actually destroyed data on a row whose version still matched the
 * editor's initial 0 (i.e. one never saved before — a freshly created page or
 * board); on anything already saved the version check returned 409 and
 * incidentally protected it. That made it look rare while being reliably
 * reproducible: a 16s load on a fresh board wiped its seeded collection-view
 * element every time.
 */
export function canSave(state: SaveGateState): boolean {
  if (!state.id) return false
  if (state.saving) return false
  if (state.conflict) return false
  if (!state.hasLoaded) return false
  return true
}
