'use client'

import { UserCircle, ExternalLink, Mail, Phone, MapPin, GraduationCap, Trophy, Target } from 'lucide-react'
import { getKit } from '@/lib/kits/registry'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'

interface PublicKitProfileElementProps {
  element: {
    id: string
    kitProfileKitId?: string
    kitProfileData?: Record<string, any>
    kitProfileLayout?: 'card' | 'full'
  }
}

export function PublicKitProfileElement({ element }: PublicKitProfileElementProps) {
  const kit = element.kitProfileKitId ? getKit(element.kitProfileKitId) : null
  const data = element.kitProfileData || {}

  if (!kit) return null

  // For athlete kit, render a purpose-built card
  if (kit.id === 'athlete') {
    return <AthleteProfileCard data={data} />
  }

  // For resume kit, render a professional profile card
  if (kit.id === 'resume') {
    return <ResumeProfileCard data={data} />
  }

  // Generic fallback: render grouped fields
  const sections: Record<string, { key: string; label: string; value: any }[]> = {}
  for (const field of kit.profileFields) {
    const value = data[field.key]
    if (!value) continue
    if (!sections[field.section]) sections[field.section] = []
    sections[field.section].push({ key: field.key, label: field.label, value })
  }

  if (Object.keys(sections).length === 0) return null

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-2">
        <UserCircle className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold">{kit.name} Profile</span>
      </div>
      <div className="p-4 space-y-4">
        {Object.entries(sections).map(([sectionName, fields]) => (
          <div key={sectionName}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{sectionName}</h4>
            <div className="space-y-1">
              {fields.map(f => (
                <div key={f.key} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResumeProfileCard({ data }: { data: Record<string, any> }) {
  const hasContact = data.email || data.phone || data.website
  const hasLinks = data.linkedinUrl || data.githubUrl || data.portfolioUrl || data.twitterUrl

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-white">
      {/* Top bar - violet gradient */}
      <div className="h-1.5 bg-gradient-to-r from-[#6C63FF] via-[#8B83FF] to-[#1FB6FF]" />

      <div className="p-5 space-y-4">
        {/* Headline & Location */}
        {(data.headline || data.location) && (
          <div>
            {data.headline && (
              <div className="text-lg font-semibold text-foreground">{data.headline}</div>
            )}
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {data.location && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  {data.location}
                </span>
              )}
              {data.yearsExperience && (
                <span className="px-2.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-xs font-medium">
                  {data.yearsExperience} years experience
                </span>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {data.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
        )}

        {/* Contact info */}
        {hasContact && (
          <div className="flex flex-wrap gap-3 text-sm">
            {data.email && (
              <a href={`mailto:${data.email}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Mail className="w-3.5 h-3.5" />
                {data.email}
              </a>
            )}
            {data.phone && (
              <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <Phone className="w-3.5 h-3.5" />
                {data.phone}
              </a>
            )}
            {data.website && (
              <a href={data.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                <ExternalLink className="w-3.5 h-3.5" />
                Website
              </a>
            )}
          </div>
        )}

        {/* Link buttons */}
        {hasLinks && (
          <div className="flex flex-wrap gap-2">
            {data.linkedinUrl && (
              <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                LinkedIn
              </a>
            )}
            {data.githubUrl && (
              <a href={data.githubUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                GitHub
              </a>
            )}
            {data.portfolioUrl && (
              <a href={data.portfolioUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                Portfolio
              </a>
            )}
            {data.twitterUrl && (
              <a href={data.twitterUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                Twitter
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AthleteProfileCard({ data }: { data: Record<string, any> }) {
  const hasPhysical = data.height || data.weight
  const hasAcademic = data.gpa || data.school
  const hasContact = data.coachName || data.coachEmail || data.coachPhone
  const hasRecruiting = data.recruitingStatus || data.desiredSchools
  const hasLinks = data.hudlUrl || data.maxprepsUrl || data.youtubeUrl
  const hasSocial = data.socialHandles

  const statusColors: Record<string, string> = {
    'Uncommitted': 'bg-amber-100 text-amber-800 border-amber-200',
    'Committed': 'bg-green-100 text-green-800 border-green-200',
    'Signed': 'bg-blue-100 text-blue-800 border-blue-200',
    'Not Recruiting': 'bg-slate-100 text-slate-600 border-slate-200',
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-white">
      {/* Top bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#39D98A] via-[#1FB6FF] to-[#6C63FF]" />

      <div className="p-5 space-y-5">
        {/* Sport & Position badge */}
        {(data.sport || data.position) && (
          <div className="flex items-center gap-2 flex-wrap">
            {data.sport && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                <Trophy className="w-3.5 h-3.5" />
                {data.sport}
              </span>
            )}
            {data.position && (
              <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium">{data.position}</span>
            )}
            {data.classYear && (
              <span className="px-3 py-1 bg-muted rounded-full text-sm font-medium">Class of {data.classYear}</span>
            )}
          </div>
        )}

        {/* Physical stats row */}
        {hasPhysical && (
          <div className="flex gap-4">
            {data.height && (
              <div className="text-center">
                <div className="text-2xl font-bold">{data.height}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Height</div>
              </div>
            )}
            {data.weight && (
              <div className="text-center">
                <div className="text-2xl font-bold">{data.weight}<span className="text-sm font-normal text-muted-foreground ml-0.5">lbs</span></div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Weight</div>
              </div>
            )}
            {data.gpa && (
              <div className="text-center">
                <div className="text-2xl font-bold">{data.gpa}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">GPA</div>
              </div>
            )}
          </div>
        )}

        {/* School */}
        {data.school && (
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            <span>{data.school}</span>
          </div>
        )}

        {/* Recruiting status */}
        {hasRecruiting && (
          <div className="space-y-2">
            {data.recruitingStatus && (
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[data.recruitingStatus] || 'bg-muted text-foreground'}`}>
                {data.recruitingStatus}
              </span>
            )}
            {data.desiredSchools && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  <Target className="w-3 h-3" />
                  Target Schools
                </div>
                <p className="text-sm text-muted-foreground">{data.desiredSchools}</p>
              </div>
            )}
          </div>
        )}

        {/* Coach contact */}
        {hasContact && (
          <div className="rounded-lg border border-border/50 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coach Contact</div>
            {data.coachName && <div className="text-sm font-medium">{data.coachName}</div>}
            {data.coachEmail && (
              <a href={`mailto:${data.coachEmail}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Mail className="w-3.5 h-3.5" />
                {data.coachEmail}
              </a>
            )}
            {data.coachPhone && (
              <a href={`tel:${data.coachPhone}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Phone className="w-3.5 h-3.5" />
                {data.coachPhone}
              </a>
            )}
          </div>
        )}

        {/* Links */}
        {hasLinks && (
          <div className="flex flex-wrap gap-2">
            {data.hudlUrl && (
              <a href={data.hudlUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                Hudl
              </a>
            )}
            {data.maxprepsUrl && (
              <a href={data.maxprepsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                MaxPreps
              </a>
            )}
            {data.youtubeUrl && (
              <a href={data.youtubeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-sm hover:bg-muted/80 transition">
                <ExternalLink className="w-3.5 h-3.5" />
                YouTube
              </a>
            )}
          </div>
        )}

        {/* Social */}
        {hasSocial && (
          <div className="text-sm text-muted-foreground">
            {data.socialHandles}
          </div>
        )}
      </div>
    </div>
  )
}
