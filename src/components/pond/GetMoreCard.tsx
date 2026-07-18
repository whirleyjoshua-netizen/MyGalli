'use client'

import { Sprout, UserPlus, MessageCircle, FolderKanban, Users } from 'lucide-react'

const ITEMS = [
  { icon: Users, title: 'Create a community', body: 'Start a space for your ideas, team, or audience.' },
  { icon: UserPlus, title: 'Invite collaborators', body: 'Bring people in to co-create and grow together.' },
  { icon: MessageCircle, title: 'Share and engage', body: 'Post updates, ask questions, and build real connections.' },
  { icon: FolderKanban, title: 'Organize your spaces', body: 'Keep your communities focused and thriving.' },
]

export function GetMoreCard({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Sprout className="w-4 h-4 text-primary" /> Get more from your pond
      </h3>
      <ul className="mt-4 space-y-4">
        {ITEMS.map((it) => (
          <li key={it.title}>
            <button onClick={it.title === 'Create a community' ? onCreate : undefined} className="flex items-start gap-3 text-left w-full">
              <span className="p-2 rounded-xl bg-muted text-primary shrink-0"><it.icon className="w-4 h-4" /></span>
              <span>
                <span className="block text-sm font-semibold text-foreground">{it.title}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{it.body}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
