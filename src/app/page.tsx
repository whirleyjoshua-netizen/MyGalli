import { existsSync } from 'fs'
import { join } from 'path'
import { LilyPond } from '@/components/marketing/LilyPond'

/**
 * Progressive-enhancement hero art: drop a generated illustration at
 * `public/hero-village.png` (or .jpg/.webp) and the lily-pond scene uses it
 * as the full-bleed background. Falls back to a CSS gradient if absent.
 */
function resolveHeroImage(): string | null {
  const candidates = ['hero-village.png', 'hero-village.jpg', 'hero-village.webp']
  for (const file of candidates) {
    if (existsSync(join(process.cwd(), 'public', file))) {
      return `/${file}`
    }
  }
  return null
}

export default function Home() {
  const heroImage = resolveHeroImage()

  return <LilyPond imageSrc={heroImage} />
}
