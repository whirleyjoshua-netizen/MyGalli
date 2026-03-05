'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Trophy, TrendingUp, BarChart3, Play, BookOpen, Sparkles, FileText, UserCircle, Briefcase, Award, FolderOpen, Heart, Music, Quote, Palette, Store, UtensilsCrossed, Star, Clock, Mail, Library, Users } from 'lucide-react'
import { KIT_REGISTRY } from '@/lib/kits/registry'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'
import '@/lib/kits/wedding-kit'
import '@/lib/kits/creative-kit'
import '@/lib/kits/creator-kit'
import '@/lib/kits/business-kit'
import '@/lib/kits/academic-kit'

const ICON_MAP: Record<string, typeof Trophy> = {
  Trophy,
  TrendingUp,
  BarChart3,
  Play,
  BookOpen,
  FileText,
  UserCircle,
  Briefcase,
  Award,
  FolderOpen,
  Heart,
  Music,
  Quote,
  Palette,
  Sparkles,
  Store,
  UtensilsCrossed,
  Star,
  Clock,
  Mail,
  Library,
  Users,
}

interface KitSelectorProps {
  isOpen: boolean
  onClose: () => void
}

export function KitSelector({ isOpen, onClose }: KitSelectorProps) {
  const router = useRouter()
  const [creating, setCreating] = useState<string | null>(null)

  if (!isOpen) return null

  const kits = Object.values(KIT_REGISTRY)

  const handleCreate = async (kitId: string) => {
    if (creating) return
    setCreating(kitId)

    try {
      const kit = KIT_REGISTRY[kitId]
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `My ${kit.name}`,
          kitId,
        }),
      })

      if (res.ok) {
        const display = await res.json()
        router.push(`/editor?id=${display.id}`)
        onClose()
      }
    } catch (err) {
      console.error('Failed to create kit page:', err)
    } finally {
      setCreating(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Choose a Kit</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 text-sm text-muted-foreground">
          Kits are purpose-built page templates with pre-wired trackers, profile cards, and structured tabs.
        </div>

        {/* Kit cards */}
        <div className="px-4 pb-6 space-y-3">
          {kits.map(kit => {
            const Icon = ICON_MAP[kit.icon] || Trophy
            return (
              <div
                key={kit.id}
                className="relative border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all group"
              >
                {/* Color accent */}
                <div className="absolute top-0 left-4 right-4 h-1 rounded-b-full" style={{ backgroundColor: kit.color }} />

                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${kit.color}15` }}
                  >
                    <Icon className="w-6 h-6" style={{ color: kit.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold mb-1">{kit.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3">{kit.description}</p>

                    {/* Module chips */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {kit.modules.map(mod => {
                        const ModIcon = ICON_MAP[mod.icon] || Trophy
                        return (
                          <span
                            key={mod.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground"
                          >
                            <ModIcon className="w-3 h-3" />
                            {mod.tabLabel}
                          </span>
                        )
                      })}
                    </div>

                    <button
                      onClick={() => handleCreate(kit.id)}
                      disabled={creating !== null}
                      className="px-5 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition disabled:opacity-50"
                    >
                      {creating === kit.id ? 'Creating...' : `Create ${kit.name}`}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}

          {kits.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No kits available yet.
            </div>
          )}

          {/* Coming soon teaser */}
          <div className="border border-dashed border-border rounded-xl p-5 text-center opacity-60">
            <p className="text-sm text-muted-foreground">More kits coming soon — Academic, Creative Portfolio, Startup Founder...</p>
          </div>
        </div>
      </div>
    </div>
  )
}
