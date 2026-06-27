'use client';

import { CheckCircle2, TrendingUp } from 'lucide-react';

const features = [
  'Team dashboard \u2014 see all athletes at a glance',
  'Performance tracking \u2014 40-yard, lifts, body metrics, game stats',
  'Recruiting-ready profiles \u2014 one link, full athlete story',
  'Coach admin tools \u2014 manage rosters, track eligibility',
  'Highlight integration \u2014 Hudl, YouTube, media embeds',
];

export default function AthleticSection() {
  return (
    <section id="for-teams" className="py-24 px-6">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        {/* Left — Text */}
        <div>
          {/* Badge */}
          <span className="inline-block rounded-full bg-galli/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-galli-dark">
            For Athletic Programs
          </span>

          {/* Heading */}
          <h2 className="mt-5 text-3xl font-bold text-foreground">
            Built for Athletic Programs
          </h2>

          {/* Feature list */}
          <ul className="mt-8 space-y-4">
            {features.map((text) => (
              <li key={text} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-galli" />
                <span className="text-sm text-foreground/90 md:text-base">
                  {text}
                </span>
              </li>
            ))}
          </ul>

          {/* Bottom note */}
          <p className="mt-8 text-sm text-muted-foreground">
            Perfect for football, basketball, soccer, track, and every sport.
          </p>
        </div>

        {/* Right — Visual mockup */}
        <div className="flex justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-lg">
            {/* Card header */}
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-galli" />
              <h3 className="text-lg font-semibold text-foreground">
                40-Yard Dash
              </h3>
            </div>

            {/* Mini stats */}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-galli/10 px-3 py-3 text-center">
                <p className="text-lg font-bold text-galli-dark">4.42s</p>
                <p className="text-[11px] text-muted-foreground">PB</p>
              </div>
              <div className="rounded-xl bg-galli/10 px-3 py-3 text-center">
                <p className="text-lg font-bold text-galli-dark">4.51s</p>
                <p className="text-[11px] text-muted-foreground">Avg</p>
              </div>
              <div className="rounded-xl bg-galli/10 px-3 py-3 text-center">
                <p className="text-lg font-bold text-galli">&#8593; 3.2%</p>
                <p className="text-[11px] text-muted-foreground">Improvement</p>
              </div>
            </div>

            {/* Mini SVG chart */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Recent trend
              </p>
              <svg
                viewBox="0 0 280 80"
                fill="none"
                className="h-20 w-full"
                aria-label="Performance trend line chart showing improvement"
              >
                {/* Grid lines */}
                <line x1="0" y1="20" x2="280" y2="20" stroke="currentColor" className="text-border" strokeDasharray="4 4" />
                <line x1="0" y1="40" x2="280" y2="40" stroke="currentColor" className="text-border" strokeDasharray="4 4" />
                <line x1="0" y1="60" x2="280" y2="60" stroke="currentColor" className="text-border" strokeDasharray="4 4" />

                {/* Gradient fill under line */}
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#39D98A" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#39D98A" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 60 L40 55 L80 50 L120 44 L160 38 L200 30 L240 24 L280 18 L280 80 L0 80 Z"
                  fill="url(#chartGradient)"
                />

                {/* Trend line */}
                <polyline
                  points="0,60 40,55 80,50 120,44 160,38 200,30 240,24 280,18"
                  stroke="#39D98A"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Data points */}
                {[
                  [0, 60], [40, 55], [80, 50], [120, 44],
                  [160, 38], [200, 30], [240, 24], [280, 18],
                ].map(([cx, cy]) => (
                  <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" fill="#39D98A" />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
