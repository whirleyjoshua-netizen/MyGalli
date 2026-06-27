'use client'

import { Building2, Users, TrendingUp } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Building2,
    title: 'Set Up Your Organization',
    description: 'Create your school or program. Add teams, classes, and clubs. Define which kits each group gets.',
    color: '#39D98A',
  },
  {
    number: '02',
    icon: Users,
    title: 'Provision Student Accounts',
    description: 'Bulk create accounts with a CSV upload. Kits auto-assign based on roles and groups. Students get instant access.',
    color: '#1FB6FF',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Watch Identities Grow',
    description: 'Students track progress. Coaches monitor performance. Portfolios build automatically over time. Share with one link.',
    color: '#6C63FF',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="text-xs font-semibold uppercase tracking-widest text-galli-aqua mb-3">
            HOW IT WORKS
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Up and running in three steps
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              {/* Number */}
              <div
                className="text-7xl font-extrabold opacity-[0.07] absolute -top-4 left-1/2 -translate-x-1/2 select-none"
                style={{ color: step.color }}
              >
                {step.number}
              </div>

              {/* Icon circle */}
              <div
                className="relative w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ backgroundColor: `${step.color}15` }}
              >
                <step.icon className="w-7 h-7" style={{ color: step.color }} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Connector line (desktop only) */}
        <div className="hidden md:block relative -mt-[11.5rem] mb-[8rem] mx-auto max-w-3xl">
          <div className="h-[2px] bg-gradient-to-r from-[#39D98A] via-[#1FB6FF] to-[#6C63FF] opacity-20 rounded-full" />
        </div>
      </div>
    </section>
  )
}
