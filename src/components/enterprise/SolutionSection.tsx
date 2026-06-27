'use client';

const stats = [
  { value: '5', label: 'Pre-built tabs' },
  { value: '4', label: 'Performance trackers' },
  { value: '16', label: 'Profile fields' },
  { value: '1', label: 'Link to share it all' },
];

export default function SolutionSection() {
  return (
    <section id="features" className="py-24 px-6">
      <div className="mx-auto max-w-6xl text-center">
        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-widest text-galli">
          The Solution
        </p>

        {/* Heading */}
        <h2 className="mt-4 text-3xl font-bold text-foreground md:text-4xl">
          Gallio Changes Everything
        </h2>

        {/* Description */}
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          Every student gets a living digital identity. Structured kits track
          what matters. Progress builds automatically over time.
        </p>

        {/* Stats row */}
        <div className="relative mx-auto mt-16 max-w-4xl">
          {/* Gradient background card */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-galli/5 via-galli-aqua/5 to-galli-violet/5 blur-sm" />
          <div className="relative rounded-2xl border border-border bg-background/60 px-6 py-10 shadow-sm backdrop-blur-sm">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-1">
                  <span className="text-4xl font-extrabold text-galli">
                    {stat.value}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
