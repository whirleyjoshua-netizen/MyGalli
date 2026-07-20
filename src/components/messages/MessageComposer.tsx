'use client'

import { useRef, useState } from 'react'
import { Plus, Image as ImageIcon, Smile, Mic, Send } from 'lucide-react'

/**
 * The attachment row renders disabled in M1 so the composer's final shape is
 * built once — M3 fills these in rather than re-flowing the layout.
 */
const PENDING_TOOLS = [
  { key: 'attach', label: 'Attach a file', Icon: Plus },
  { key: 'image', label: 'Add an image', Icon: ImageIcon },
  { key: 'emoji', label: 'Add an emoji', Icon: Smile },
  { key: 'voice', label: 'Record a voice note', Icon: Mic },
] as const

export function MessageComposer({
  onSend,
  disabled,
}: {
  onSend: (body: string) => void
  disabled: boolean
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const body = value.trim()
    if (!body) return
    onSend(body)
    setValue('')
    if (ref.current) ref.current.style.height = 'auto'
  }

  const grow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  return (
    <div className="border-t border-border p-3">
      <div className="rounded-2xl border border-border bg-surface px-3 py-2">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder="Type a message..."
          aria-label="Message"
          onChange={(e) => {
            setValue(e.target.value)
            grow(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            {PENDING_TOOLS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                disabled
                aria-label={label}
                title={`${label} — coming soon`}
                className="cursor-not-allowed rounded-lg p-2 text-muted-foreground opacity-50"
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={send}
            disabled={disabled}
            aria-label="Send message"
            className="rounded-full bg-galli p-2 text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
