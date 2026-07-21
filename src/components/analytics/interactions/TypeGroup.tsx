'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function TypeGroup({
  label,
  count,
  defaultOpen = true,
  children,
}: {
  label: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mb-3 flex w-full items-center gap-2 text-left"
      >
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${open ? '' : '-rotate-90'}`} />
        <h2 className="text-base font-bold">{label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{count}</span>
      </button>
      {open && <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>}
    </section>
  )
}
