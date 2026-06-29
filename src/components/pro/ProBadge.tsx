import { Sparkles } from 'lucide-react'

export function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-galli-violet/15 px-2 py-0.5 text-[10px] font-semibold text-galli-violet ${className}`}
    >
      <Sparkles className="h-3 w-3" />
      Pro
    </span>
  )
}
