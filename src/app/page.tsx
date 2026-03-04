import Link from 'next/link'
import Image from 'next/image'
import {
  Layers,
  BarChart3,
  Share2,
  Palette,
  Trophy,
  FileText,
  Heart,
  Zap,
  Globe,
  Shield,
} from 'lucide-react'

const FEATURES = [
  {
    icon: Layers,
    title: 'Interactive Elements',
    description: 'Drag-and-drop cards, polls, forms, trackers, and more onto a beautiful canvas.',
  },
  {
    icon: Palette,
    title: 'Starter Kits',
    description: 'Launch fast with pre-built kits for athletes, resumes, weddings, and more.',
  },
  {
    icon: BarChart3,
    title: 'Built-in Analytics',
    description: 'Track views, form responses, and engagement — no third-party tools needed.',
  },
  {
    icon: Share2,
    title: 'Share Anywhere',
    description: 'Custom share links, public pages, and embeddable displays.',
  },
  {
    icon: Globe,
    title: 'Your Own URL',
    description: 'Every page lives at gallio.app/you — a clean, memorable link.',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'You control what\'s public. Unpublished pages stay private.',
  },
]

const KITS = [
  {
    icon: Trophy,
    name: 'Athlete Kit',
    description: 'Game schedules, performance trackers, workout logs, signable jerseys.',
    color: 'from-green-500/20 to-emerald-500/10',
  },
  {
    icon: FileText,
    name: 'Resume Kit',
    description: 'Education, experience, skills, and certifications — beautifully formatted.',
    color: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    icon: Heart,
    name: 'Wedding Kit',
    description: 'Timeline, party members, registry, RSVP, and hashtag walls.',
    color: 'from-pink-500/20 to-rose-500/10',
  },
]

export default function Home() {
  return (
    <main className="min-h-screen relative overflow-hidden bg-background">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-gallio/5 via-transparent to-gallio-aqua/5 pointer-events-none" />
      <div className="absolute top-20 -right-40 w-96 h-96 bg-gallio/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-40 w-96 h-96 bg-gallio-violet/10 rounded-full blur-3xl pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Image src="/gallio-frog.svg" alt="Gallio" width={32} height={32} />
          <span className="text-xl font-bold text-gallio-gradient">Gallio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/explore"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Explore
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 bg-primary text-primary-foreground text-sm rounded-full font-medium hover:shadow-lg hover:shadow-gallio/25 transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center pt-20 pb-24 px-4">
        <div className="mb-6 w-20 h-20 relative">
          <Image src="/gallio-frog.svg" alt="Gallio" width={80} height={80} />
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold text-center tracking-tight text-gallio-gradient">
          Gallio
        </h1>
        <p className="mt-4 text-xl md:text-2xl text-muted-foreground text-center max-w-2xl">
          A living gallery of you.
        </p>
        <p className="mt-3 text-muted-foreground text-center max-w-lg leading-relaxed">
          Build interactive pages for anything — athlete profiles, resumes, wedding sites, and more.
          Drag, drop, publish, share.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link
            href="/signup"
            className="px-8 py-3.5 bg-primary text-primary-foreground rounded-full font-semibold text-lg hover:shadow-xl hover:shadow-gallio/25 hover:scale-[1.02] transition-all text-center"
          >
            Create Your Page
          </Link>
          <Link
            href="/explore"
            className="px-8 py-3.5 border border-border rounded-full font-medium text-lg hover:bg-muted transition-all text-center"
          >
            See Examples
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Everything you need, nothing you don&apos;t
        </h2>
        <p className="text-muted-foreground text-center max-w-xl mx-auto mb-14">
          No code. No complexity. Just a beautiful page that works.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-border bg-background/80 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-gallio/5 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Kits Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Starter Kits
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Launch in minutes, not hours
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Pick a kit, customize it, and go live. Each kit comes with purpose-built elements and layouts.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {KITS.map((kit) => (
            <div
              key={kit.name}
              className={`p-6 rounded-2xl border border-border bg-gradient-to-br ${kit.color} hover:border-primary/30 transition-all`}
            >
              <div className="w-12 h-12 rounded-xl bg-background/80 border border-border flex items-center justify-center mb-4">
                <kit.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{kit.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {kit.description}
              </p>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link
            href="/signup"
            className="text-primary font-medium hover:underline"
          >
            More kits coming soon →
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-24">
        <div className="rounded-3xl bg-gradient-to-br from-gallio/10 via-gallio-aqua/5 to-gallio-violet/10 border border-primary/20 p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to build yours?
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Free to start. No credit card required. Your page is live in under a minute.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 bg-primary text-primary-foreground rounded-full font-semibold text-lg hover:shadow-xl hover:shadow-gallio/25 hover:scale-[1.02] transition-all"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/gallio-frog.svg" alt="Gallio" width={24} height={24} />
            <span className="text-sm text-muted-foreground">
              Gallio &mdash; A living gallery of you.
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/explore" className="hover:text-foreground transition">Explore</Link>
            <Link href="/login" className="hover:text-foreground transition">Log in</Link>
            <Link href="/signup" className="hover:text-foreground transition">Sign up</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
