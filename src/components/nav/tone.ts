/**
 * Visual tone for the shared top bar and its controls.
 *
 * - `glass` — frosted Anchor green over a dark/!white surface (Explore).
 * - `light` — white glass that blends into a light page (public profile).
 *
 * Lives in its own module so GalliTopBar and SearchBox can share the type
 * without importing each other.
 */
export type BarTone = 'glass' | 'light'
