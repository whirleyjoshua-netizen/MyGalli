'use client'

import { Trophy, GraduationCap, Building2, Check, Sparkles } from 'lucide-react'

const tiers = [
  {
    name: 'Athletic Program',
    price: 'Per team, per season',
    icon: Trophy,
    color: '#39D98A',
    features: [
      'Coach dashboard for all athletes',
      'Athlete Kit for every player',
      'Performance trackers (speed, lifts, stats)',
      'Recruiting-ready profiles',
      'Team showcase page',
    ],
    cta: 'For coaches & ADs',
  },
  {
    name: 'School',
    price: 'Per student, per year',
    icon: GraduationCap,
    color: '#6C63FF',
    featured: true,
    features: [
      'Everything in Athletic Program',
      'All kit types (Academic, Creative, etc.)',
      'Admin console with full controls',
      'Role-based access (5 roles)',
      'Graduating class showcases',
      'FERPA compliance mode',
    ],
    cta: 'For schools & academies',
  },
  {
    name: 'District',
    price: 'Custom pricing',
    icon: Building2,
    color: '#1FB6FF',
    features: [
      'Everything in School',
      'SSO integration (Google, Clever)',
      'Custom branding per school',
      'District-wide analytics',
      'Dedicated support',
      'API access',
    ],
    cta: 'For districts',
  },
]

export function PricingTeaser() {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="text-xs font-semibold uppercase tracking-widest text-galli-violet mb-3">
            PRICING
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
            Plans for every program
          </h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-galli/10 text-galli-dark rounded-full text-sm font-medium">
            <Sparkles className="w-3.5 h-3.5 text-gallio" />
            Early access partners get founding pricing
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 transition-all ${
                tier.featured
                  ? 'border-galli-violet/40 shadow-lg shadow-galli-violet/10 scale-[1.02]'
                  : 'border-border shadow-sm hover:shadow-md'
              }`}
            >
              {/* Featured badge */}
              {tier.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-galli-violet text-white text-xs font-semibold rounded-full">
                  Most Popular
                </div>
              )}

              {/* Color accent */}
              <div className="absolute top-0 left-4 right-4 h-1 rounded-b-full" style={{ backgroundColor: tier.color }} />

              {/* Icon */}
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{ backgroundColor: `${tier.color}15` }}
              >
                <tier.icon className="w-6 h-6" style={{ color: tier.color }} />
              </div>

              {/* Name & Price */}
              <h3 className="text-xl font-bold mb-1">{tier.name}</h3>
              <p className="text-sm text-muted-foreground mb-5">{tier.price}</p>

              {/* Features */}
              <ul className="space-y-2.5 mb-6">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: tier.color }} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <a
                href="#waitlist"
                className="block text-center px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-[1.02]"
                style={{
                  backgroundColor: tier.featured ? tier.color : `${tier.color}15`,
                  color: tier.featured ? 'white' : tier.color,
                }}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include unlimited tracker entries, public sharing, and analytics.
          <br />
          Final pricing announced when Enterprise launches. Waitlist members lock in founding rates.
        </p>
      </div>
    </section>
  )
}
