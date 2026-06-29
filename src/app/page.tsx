import { existsSync } from 'fs'
import { join } from 'path'
import { LandingNav } from '@/components/marketing/LandingNav'
import { Hero } from '@/components/marketing/Hero'
import { FeatureSection } from '@/components/marketing/FeatureSection'
import { TemplateCarousel } from '@/components/marketing/TemplateCarousel'
import { Testimonial } from '@/components/marketing/Testimonial'
import { FinalCTA } from '@/components/marketing/FinalCTA'
import { LandingFooter } from '@/components/marketing/LandingFooter'

/**
 * Progressive-enhancement hero art: drop a generated illustration at
 * `public/hero-village.png` (or .jpg/.webp) and it replaces the CSS scene
 * automatically — no code change needed.
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

  return (
    <main className="min-h-screen bg-gradient-to-b from-galli-aqua/15 via-background to-background">
      <LandingNav />
      <Hero imageSrc={heroImage} />
      <FeatureSection />
      <TemplateCarousel />
      <Testimonial />
      <FinalCTA />
      <LandingFooter />
    </main>
  )
}
