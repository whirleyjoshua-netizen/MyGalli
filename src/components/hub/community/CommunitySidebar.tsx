'use client'

import { useState } from 'react'
import { UsersRound, FolderOpen, FileText, LinkIcon } from 'lucide-react'
import { hubVideoEmbed } from '@/lib/hub-video-embed'

type Member = { userId: string; username: string; name: string | null; avatar: string | null }
type Resource = { id: string; type: string; title: string; url: string | null }

export function CommunitySidebar({
  heroVideoUrl, members, resources,
}: {
  heroVideoUrl: string | null
  members: Member[]
  resources: Resource[]
}) {
  const [showMembers, setShowMembers] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const embed = hubVideoEmbed(heroVideoUrl)

  return (
    <div className="space-y-4">
      {embed && (
        <div className="overflow-hidden rounded-2xl border border-border bg-black">
          {embed.kind === 'file' ? (
            <video src={embed.src} controls className="aspect-video w-full" />
          ) : (
            <iframe src={embed.src} title="Community video" allow="fullscreen; picture-in-picture" className="aspect-video w-full" />
          )}
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="h-4 w-4 text-primary" /> Members ({members.length})</h3>
          {members.length > 6 && <button onClick={() => setShowMembers(true)} className="text-xs text-primary hover:underline">View all →</button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {members.slice(0, 12).map((m) => (
            <span key={m.userId} title={m.name || m.username} className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
              {m.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.avatar} alt="" className="h-full w-full object-cover" />
              )}
            </span>
          ))}
        </div>
      </section>

      {resources.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface p-4">
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
      )}

      {showMembers && (
        <Modal title={`Members (${members.length})`} onClose={() => setShowMembers(false)}>
          {members.map((m) => (
            <div key={m.userId} className="flex items-center gap-2 py-1.5">
              <span className="h-8 w-8 overflow-hidden rounded-full bg-gradient-to-br from-galli/30 to-galli-violet/30">
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
    </div>
  )
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
