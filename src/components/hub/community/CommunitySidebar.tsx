'use client'

import { useState } from 'react'
import { UsersRound, FolderOpen, FileText, LinkIcon, CalendarDays } from 'lucide-react'
import { hubVideoEmbed } from '@/lib/hub-video-embed'
import type { HubConfig, HubSidebarKey } from '@/lib/types/hub-config'
import type { EventDTO } from '@/lib/hub-events'

type Member = { userId: string; username: string; name: string | null; avatar: string | null }
type Resource = { id: string; type: string; title: string; url: string | null }

export function CommunitySidebar({
  config, heroVideoUrl, members, resources, events = [],
}: {
  config: HubConfig
  heroVideoUrl: string | null
  members: Member[]
  resources: Resource[]
  events?: EventDTO[]
}) {
  const [showMembers, setShowMembers] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const [showEvents, setShowEvents] = useState(false)
  const embed = hubVideoEmbed(heroVideoUrl)

  const widget = (key: HubSidebarKey) => {
    if (key === 'video') {
      if (!embed) return null
      return (
        <div key="video" className="overflow-hidden rounded-2xl border border-border bg-black">
          {embed.kind === 'file' ? (
            <video src={embed.src} controls className="aspect-video w-full" />
          ) : (
            <iframe src={embed.src} title="Community video" allow="fullscreen; picture-in-picture" className="aspect-video w-full" />
          )}
        </div>
      )
    }
    if (key === 'members') {
      return (
        <section key="members" className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-primary" /> Members ({members.length})</h3>
            {members.length > 6 && <button onClick={() => setShowMembers(true)} className="text-xs text-primary hover:underline">View all →</button>}
          </div>
          <div className="flex flex-wrap gap-2">
            {members.slice(0, 12).map((m) => (
              <span key={m.userId} title={m.name || m.username} className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-hub-accent/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
            ))}
          </div>
        </section>
      )
    }
    if (key === 'events') {
      const upcoming = events // already upcoming from the server; empty ⇒ hide
      if (upcoming.length === 0) return null
      return (
        <section key="events" className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="h-4 w-4 text-primary" /> Upcoming</h3>
            {upcoming.length > 3 && <button onClick={() => setShowEvents(true)} className="text-xs text-primary hover:underline">View all →</button>}
          </div>
          <ul className="space-y-3">
            {upcoming.slice(0, 3).map((e) => (
              <li key={e.id} className="flex gap-3">
                <EventDateChip iso={e.startsAt} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{eventWhen(e)}</p>
                  {e.location && <EventLocation location={e.location} />}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )
    }
    // resources
    if (resources.length === 0) return null
    return (
      <section key="resources" className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><FolderOpen className="h-4 w-4 text-primary" /> Resources</h3>
          {resources.length > 5 && <button onClick={() => setShowResources(true)} className="text-xs text-primary hover:underline">View all →</button>}
        </div>
        <ul className="space-y-2">
          {resources.slice(0, 5).map((r) => (
            <li key={r.id}>
              <a href={r.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm hover:text-primary">
                {r.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
                <span className="truncate">{r.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {config.sidebar.filter((w) => w.enabled).map((w) => widget(w.key))}

      {showMembers && (
        <Modal title={`Members (${members.length})`} onClose={() => setShowMembers(false)}>
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 py-1.5">
              <span className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-primary/30 to-hub-accent/30">
                {m.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <span className="text-sm">{m.name || m.username} <span className="text-muted-foreground">@{m.username}</span></span>
            </div>
          ))}
        </Modal>
      )}
      {showResources && (
        <Modal title="Resources" onClose={() => setShowResources(false)}>
          {resources.map((r) => (
            <a key={r.id} href={r.url || '#'} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-1.5 text-sm hover:text-primary">
              {r.type === 'link' ? <LinkIcon className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
              <span className="truncate">{r.title}</span>
            </a>
          ))}
        </Modal>
      )}
      {showEvents && (
        <Modal title="Upcoming events" onClose={() => setShowEvents(false)}>
          {events.map((e) => (
            <div key={e.id} className="flex gap-3 py-1.5">
              <EventDateChip iso={e.startsAt} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">{eventWhen(e)}</p>
                {e.location && <EventLocation location={e.location} />}
                {e.description && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">{e.description}</p>}
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}

function EventDateChip({ iso }: { iso: string }) {
  const d = new Date(iso)
  const mon = d.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
      <span className="text-[10px] font-semibold leading-none">{mon}</span>
      <span className="text-base font-bold leading-none">{d.getDate()}</span>
    </span>
  )
}
function eventWhen(e: EventDTO): string {
  const d = new Date(e.startsAt)
  const day = d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = e.allDay ? 'All day' : d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
  const where = e.isOnline ? ' · Online' : ''
  return `${day} · ${time}${where}`
}

function EventLocation({ location }: { location: string }) {
  if (/^https?:\/\//i.test(location)) {
    return (
      <a href={location} target="_blank" rel="noreferrer" className="block truncate text-xs text-primary hover:underline">
        {location}
      </a>
    )
  }
  return <p className="truncate text-xs text-muted-foreground">{location}</p>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-lg font-bold">{title}</h2>
        {children}
        <button onClick={onClose} className="mt-4 w-full rounded-lg border border-border py-2 text-sm">Close</button>
      </div>
    </div>
  )
}
