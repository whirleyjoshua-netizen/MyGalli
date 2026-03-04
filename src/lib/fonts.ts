// Google Fonts loading utility

export interface GoogleFont {
  family: string
  variants: string[]
  category: 'serif' | 'sans-serif' | 'display' | 'handwriting' | 'monospace'
}

const loadedFonts = new Set<string>()

export function loadGoogleFont(family: string, weights: number[] = [400, 700]): void {
  if (typeof window === 'undefined') return
  if (loadedFonts.has(family)) return
  loadedFonts.add(family)

  const familyParam = family.replace(/ /g, '+')
  const weightsStr = weights.join(';')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${familyParam}:ital,wght@0,${weightsStr};1,${weightsStr}&display=swap`
  document.head.appendChild(link)
}

export function isFontLoaded(family: string): boolean {
  return loadedFonts.has(family)
}

export { GOOGLE_FONTS } from './google-fonts-data'
