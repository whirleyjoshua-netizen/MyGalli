import Image from 'next/image'

export type PageHeroProps = {
  icon: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
  controls?: React.ReactNode
  tabs?: React.ReactNode
}

export function PageHero({ icon, title, subtitle, action, controls, tabs }: PageHeroProps) {
  return (
    <div className="relative overflow-hidden px-6 lg:px-8 py-7">
      {/* Decorative banner — bleeds into the top-right, faded on the left */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-3/5 md:block" aria-hidden="true">
        <Image
          src="/page-banner.png"
          alt=""
          fill
          priority
          sizes="60vw"
          className="object-cover object-right"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-transparent" />
      </div>

      {/* Header row */}
      <div className="relative z-10 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            {icon} {title}
          </h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {(controls || action) && (
          <div className="flex items-center gap-2 shrink-0">
            {controls}
            {action}
          </div>
        )}
      </div>

      {/* Tabs slot */}
      {tabs && <div className="relative z-10 mt-6 flex gap-0 border-b border-border">{tabs}</div>}
    </div>
  )
}
