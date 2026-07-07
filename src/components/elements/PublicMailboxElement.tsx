'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { MailboxComposer, type MailboxPayload } from './MailboxComposer'

export function PublicMailboxElement({ element }: { element: CanvasElement }) {
  const displayId = (element as { displayId?: string }).displayId || ''

  const onSubmit = async (p: MailboxPayload) => {
    const res = await fetch('/api/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayId, elementId: element.id,
        kind: p.kind, body: p.body, mediaUrl: p.mediaUrl,
        senderName: p.senderName, senderEmail: p.senderEmail, hp: p.hp,
      }),
    })
    return { ok: res.ok }
  }

  return (
    <MailboxComposer
      title={element.mailboxTitle}
      prompt={element.mailboxPrompt}
      allowAudio={element.mailboxAllowAudio ?? true}
      requireName={element.mailboxRequireName ?? false}
      buttonLabel={element.mailboxButtonLabel}
      thankYou={element.mailboxThankYou}
      onSubmit={onSubmit}
    />
  )
}
