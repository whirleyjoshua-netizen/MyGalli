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
// the default a visual no-op for every hub that never picks a theme — and
// hub-themes.test.ts reads globals.css to keep the two from drifting apart.
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
