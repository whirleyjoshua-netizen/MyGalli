'use client'

export function LastUpdatedSettingsBody({
  value,
  onChange,
}: {
  value: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">Show when this page was last updated</span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-label="Show when this page was last updated"
          onClick={() => onChange(!value)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition cursor-pointer ${
            value ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-soft transition-all ${
              value ? 'left-[1.125rem]' : 'left-0.5'
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Visitors will see the date you last changed this page. Off by default.
      </p>
    </div>
  )
}
