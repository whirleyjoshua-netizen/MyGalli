'use client'

export function RequestBanner({
  name,
  onAccept,
  onIgnore,
  busy,
}: {
  name: string
  onAccept: () => void
  onIgnore: () => void
  busy: boolean
}) {
  return (
    <div className="border-t border-border p-4 text-center">
      <p className="text-sm font-semibold text-foreground">{name} wants to message you</p>
      <p className="mt-1 text-xs text-muted-foreground">
        They can&apos;t see whether you&apos;ve read this until you accept.
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button
          onClick={onIgnore}
          disabled={busy}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
        >
          Ignore
        </button>
        <button
          onClick={onAccept}
          disabled={busy}
          className="rounded-full bg-galli px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          Accept
        </button>
      </div>
    </div>
  )
}
