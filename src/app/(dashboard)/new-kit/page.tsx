'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Trophy, TrendingUp, BarChart3, Play, BookOpen, Sparkles, Users, Briefcase, Palette, FileText, UserCircle, Award, FolderOpen, Heart } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { KIT_REGISTRY } from '@/lib/kits/registry'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'
import '@/lib/kits/wedding-kit'

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
}

export default function NewKitPage() {
  const router = useRouter()
  const { token } = useAuthStore()
  const [creating, setCreating] = useState<string | null>(null)

  const kits = Object.values(KIT_REGISTRY)

  const handleCreate = async (kitId: string) => {
    if (!token || creating) return
    setCreating(kitId)

    try {
      const kit = KIT_REGISTRY[kitId]
      const res = await fetch('/api/displays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: `My ${kit.name}`,
          kitId,
        }),
      })

      if (res.ok) {
        const display = await res.json()
        router.push(`/editor?id=${display.id}`)
      }
    } catch (err) {
      console.error('Failed to create kit page:', err)
    } finally {
      setCreating(null)
    }
  }

  // Upcoming kits (teaser cards)
  const upcomingKits = [
    { name: 'Academic Portfolio', description: 'Showcase research, publications, and coursework', icon: BookOpen, color: '#1FB6FF' },
    { name: 'Creative Portfolio', description: 'Display your artwork, photography, and design work', icon: Palette, color: '#6C63FF' },
    { name: 'Startup Founder', description: 'Pitch deck, metrics dashboard, and team profiles', icon: Briefcase, color: '#f59e0b' },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex items-center gap-4 px-6 py-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Hero section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Kit Pages
          </div>
          <h1 className="text-3xl font-bold mb-3">Choose a Kit</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Kits are purpose-built page templates with pre-wired trackers, profile cards, and structured tabs — ready to fill in and publish.
          </p>
        </div>

        {/* Available Kits */}
        <div className="space-y-4 mb-16">
          {kits.map((kit) => {
            const Icon = ICON_MAP[kit.icon] || Trophy
            return (
              <div
                key={kit.id}
                className="relative border border-border rounded-2xl p-6 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 transition-all group bg-background"
              >
                {/* Color accent */}
                <div
                  className="absolute top-0 left-6 right-6 h-1 rounded-b-full"
                  style={{ backgroundColor: kit.color }}
                />

                <div className="flex items-start gap-5">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${kit.color}15` }}
                  >
                    <Icon className="w-7 h-7" style={{ color: kit.color }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">{kit.name}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{kit.description}</p>
                      </div>
                      <button
                        onClick={() => handleCreate(kit.id)}
                        disabled={creating !== null}
                        className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition disabled:opacity-50 flex-shrink-0"
                      >
                        {creating === kit.id ? 'Creating...' : `Create ${kit.name}`}
                      </button>
                    </div>

                    {/* Modules */}
                    <div className="flex flex-wrap gap-2">
                      {kit.modules.map((mod) => {
                        const ModIcon = ICON_MAP[mod.icon] || Trophy
                        return (
                          <span
                            key={mod.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-muted rounded-full text-xs font-medium text-muted-foreground"
                          >
                            <ModIcon className="w-3 h-3" />
                            {mod.tabLabel}
                          </span>
                        )
                      })}
                    </div>

                    {/* Trackers preview */}
                    {kit.trackers.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <div className="text-xs font-medium text-muted-foreground mb-2">
                          Included Trackers
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {kit.trackers.map((tracker) => (
                            <span
                              key={tracker.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border border-border"
                            >
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: tracker.color }}
                              />
                              {tracker.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Coming Soon section */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold mb-4 text-center text-muted-foreground">Coming Soon</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {upcomingKits.map((kit) => (
              <div
                key={kit.name}
                className="border border-dashed border-border rounded-xl p-5 opacity-60 hover:opacity-80 transition"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                  style={{ backgroundColor: `${kit.color}15` }}
                >
                  <kit.icon className="w-5 h-5" style={{ color: kit.color }} />
                </div>
                <h3 className="font-medium text-sm mb-1">{kit.name}</h3>
                <p className="text-xs text-muted-foreground">{kit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
