'use client';

import { CheckCircle2, Shield } from 'lucide-react';

const features = [
  'Digital portfolios from day one \u2014 freshmen start, seniors graduate with everything',
  'Academic + athletic + creative \u2014 one platform, multiple kits',
  'Role-based access \u2014 students, teachers, coaches, admins, parents',
  'Privacy-first \u2014 FERPA-aware, admin-controlled visibility',
  'Graduating class showcases \u2014 \u2018Class of 2026\u2019 public collections',
];

const miniStudents = [
  { initials: 'JM', color: 'bg-galli-violet' },
  { initials: 'KL', color: 'bg-galli-aqua' },
  { initials: 'TS', color: 'bg-galli' },
  { initials: 'AR', color: 'bg-galli-violet/70' },
  { initials: 'WD', color: 'bg-galli-aqua/70' },
];

export default function SchoolSection() {
  return (
    <section id="for-schools" className="py-24 px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        {/* Left — Visual mockup */}
        <div className="flex justify-center md:order-1">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-lg">
            {/* Card header */}
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-galli-violet" />
              <h3 className="text-lg font-semibold text-foreground">
                Lincoln High School
              </h3>
            </div>

            {/* Mini stats row */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-galli-violet/10 px-3 py-3 text-center">
                <p className="text-lg font-bold text-galli-violet">142</p>
                <p className="text-[11px] text-muted-foreground">Students</p>
              </div>
              <div className="rounded-xl bg-galli-violet/10 px-3 py-3 text-center">
                <p className="text-lg font-bold text-galli-violet">6</p>
                <p className="text-[11px] text-muted-foreground">Teams</p>
              </div>
              <div className="rounded-xl bg-galli-violet/10 px-3 py-3 text-center">
                <p className="text-lg font-bold text-galli-violet">4</p>
                <p className="text-[11px] text-muted-foreground">Kits Active</p>
              </div>
            </div>

            {/* Student avatars */}
            <div className="mt-6">
              <p className="mb-3 text-xs font-medium text-muted-foreground">
                Recent students
              </p>
              <div className="flex items-center -space-x-2">
                {miniStudents.map((student) => (
                  <div
                    key={student.initials}
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${student.color} text-xs font-semibold text-white ring-2 ring-background`}
                  >
                    {student.initials}
                  </div>
                ))}
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
                  +137
                </div>
              </div>
            </div>

            {/* Mini activity row */}
            <div className="mt-6 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Kit activity
              </p>
              {[
                { label: 'Academic Portfolio', pct: 87, color: 'bg-galli-violet' },
                { label: 'Athletic Profile', pct: 64, color: 'bg-galli-aqua' },
                { label: 'Creative Showcase', pct: 41, color: 'bg-galli' },
              ].map((kit) => (
                <div key={kit.label}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground/80">{kit.label}</span>
                    <span className="text-muted-foreground">{kit.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full ${kit.color}`}
                      style={{ width: `${kit.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Text */}
        <div className="md:order-2">
          {/* Badge */}
          <span className="inline-block rounded-full bg-galli-violet/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-galli-violet">
            For Schools &amp; Districts
          </span>

          {/* Heading */}
          <h2 className="mt-5 text-3xl font-bold text-foreground">
            Student Identity Infrastructure
          </h2>

          {/* Feature list */}
          <ul className="mt-8 space-y-4">
            {features.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-galli-violet" />
                <span className="text-sm text-foreground/90 md:text-base">
                  {text}
                </span>
              </li>
            ))}
          </ul>

          {/* Bottom note */}
          <p className="mt-8 text-sm text-muted-foreground">
            From prep schools to public districts.
          </p>
        </div>
      </div>
    </section>
  );
}
