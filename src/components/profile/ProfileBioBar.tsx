import { Leaf } from 'lucide-react'

export function ProfileBioBar({ bio }: { bio: string | null }) {
  if (!bio) return null
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-soft">
      <Leaf className="w-4 h-4 text-primary shrink-0" />
      <p className="text-sm text-foreground">{bio}</p>
    </div>
  )
}
