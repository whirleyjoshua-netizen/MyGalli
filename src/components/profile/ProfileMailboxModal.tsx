'use client'

import { X } from 'lucide-react'
import { MailboxComposer, type MailboxPayload } from '@/components/elements/MailboxComposer'

export function ProfileMailboxModal({
  username,
  name,
  onClose,
}: {
  username: string
  name: string | null
  onClose: () => void
}) {
  const onSubmit = async (p: MailboxPayload) => {
    const res = await fetch('/api/messages/profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username, kind: p.kind, body: p.body, mediaUrl: p.mediaUrl,
        senderName: p.senderName, senderEmail: p.senderEmail, hp: p.hp,
      }),
    })
    return { ok: res.ok }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-semibold">Message {name || `@${username}`}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="w-4 h-4" />
          </button>
        </div>
        <MailboxComposer
          title="Send me a message"
          prompt="This goes straight to my private inbox."
          allowAudio
          onSubmit={onSubmit}
        />
      </div>
    </div>
  )
}
