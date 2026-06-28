import { Instagram, Twitter, Youtube, Music, Linkedin, Github, Globe } from 'lucide-react'
import { detectLinkProvider } from '@/lib/profile'

const ICONS = {
  instagram: Instagram,
  x: Twitter,
  youtube: Youtube,
  tiktok: Music,
  linkedin: Linkedin,
  github: Github,
  web: Globe,
} as const

export function ProfileAbout({
  bio,
  interests,
  links,
}: {
  bio?: string | null
  interests: string[]
  links: { label: string; url: string }[]
}) {
  const hasContent = (bio && bio.trim()) || interests.length > 0 || links.length > 0
  if (!hasContent) return null

  return (
    <div className="mt-6 p-5 rounded-2xl border border-border bg-surface shadow-soft space-y-4">
      {bio && bio.trim() && (
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{bio}</p>
      )}

      {interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {interests.map((it) => (
            <span key={it} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {it}
            </span>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => {
            const Icon = ICONS[detectLinkProvider(l.url)]
            return (
              <a
                key={`${l.label}-${l.url}`}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-muted transition-colors cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5 text-primary" />
                {l.label}
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
