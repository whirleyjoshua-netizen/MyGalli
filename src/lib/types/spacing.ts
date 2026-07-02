// Page Spacing / Layout Configuration Types
//
// Page-level margin + spacing controls, adjustable in the editor and applied
// identically on the published page. Stored as JSON on Display.spacing.
// Values resolve to concrete pixel numbers (applied via inline styles) rather
// than Tailwind classes so they survive JIT purging and stay consistent across
// the editor canvas, the public slug page, and PublicTabView.

export type ContentWidth = 'narrow' | 'normal' | 'wide' | 'full'
export type SpacingScale = 'compact' | 'normal' | 'relaxed'
export type PagePadding = 'none' | 'small' | 'normal' | 'large'

export interface SpacingConfig {
  // Side margins — the max content width; the remainder becomes side whitespace.
  contentWidth: ContentWidth
  // Vertical gap between stacked sections (also scales the gap between columns).
  sectionSpacing: SpacingScale
  // Gap between elements within a column.
  elementSpacing: SpacingScale
  // Outer breathing room around the whole page content.
  pagePadding: PagePadding
}

// Default reproduces the current published-page look (max-w-6xl, py-12 px-4,
// space-y-8 sections, gap-6 columns, space-y-4 elements).
export const DEFAULT_SPACING_CONFIG: SpacingConfig = {
  contentWidth: 'normal',
  sectionSpacing: 'normal',
  elementSpacing: 'normal',
  pagePadding: 'normal',
}

// contentWidth → max content width in px (undefined = full-bleed 100%).
const CONTENT_WIDTH_PX: Record<ContentWidth, number | undefined> = {
  narrow: 720,
  normal: 1152, // matches Tailwind max-w-6xl (72rem)
  wide: 1536,
  full: undefined,
}

// sectionSpacing → { section gap, column gap } in px.
const SECTION_SPACING_PX: Record<SpacingScale, { section: number; column: number }> = {
  compact: { section: 16, column: 16 },
  normal: { section: 32, column: 24 },
  relaxed: { section: 56, column: 40 },
}

// elementSpacing → gap between elements within a column, in px.
const ELEMENT_SPACING_PX: Record<SpacingScale, number> = {
  compact: 8,
  normal: 16,
  relaxed: 28,
}

// pagePadding → { vertical, horizontal } outer padding in px.
const PAGE_PADDING_PX: Record<PagePadding, { y: number; x: number }> = {
  none: { y: 0, x: 16 },
  small: { y: 24, x: 16 },
  normal: { y: 48, x: 16 },
  large: { y: 80, x: 24 },
}

export interface ResolvedSpacing {
  maxWidth?: number // undefined = 100% (full width)
  paddingX: number
  paddingY: number
  sectionGap: number
  columnGap: number
  elementGap: number
}

// Resolve a (possibly partial / legacy-null) config into concrete pixel values.
export function getSpacingStyles(config?: SpacingConfig | null): ResolvedSpacing {
  const c = { ...DEFAULT_SPACING_CONFIG, ...(config || {}) }
  const section = SECTION_SPACING_PX[c.sectionSpacing] ?? SECTION_SPACING_PX.normal
  const padding = PAGE_PADDING_PX[c.pagePadding] ?? PAGE_PADDING_PX.normal

  return {
    maxWidth: CONTENT_WIDTH_PX[c.contentWidth],
    paddingX: padding.x,
    paddingY: padding.y,
    sectionGap: section.section,
    columnGap: section.column,
    elementGap: ELEMENT_SPACING_PX[c.elementSpacing] ?? ELEMENT_SPACING_PX.normal,
  }
}

// Convenience: inline style for the centered content container (side margins).
export function getContainerStyle(config?: SpacingConfig | null): React.CSSProperties {
  const s = getSpacingStyles(config)
  return {
    maxWidth: s.maxWidth ? `${s.maxWidth}px` : '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    paddingLeft: `${s.paddingX}px`,
    paddingRight: `${s.paddingX}px`,
  }
}
