'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface PadModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/**
 * Storybook-themed modal used by the lily-pond landing scene.
 * Cream/parchment card with a wooden-brown border and green heading.
 * Closes on Escape, backdrop click, and the X button. Locks body scroll
 * while open and restores focus to the trigger on close. Tall content
 * scrolls inside the card so the page underneath never scrolls.
 */
export function PadModal({ isOpen, onClose, title, children }: PadModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const prevActive = document.activeElement as HTMLElement | null
    const prevOverflow = document.body.style.overflow

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      // Trap focus within the dialog while open.
      const root = dialogRef.current
      if (!root) return
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      )
      if (focusable.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (e.shiftKey) {
        if (active === first || active === root) {
          e.preventDefault()
          last.focus()
        }
      } else if (active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    dialogRef.current?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevActive?.focus?.()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="animate-pad-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-[#0F3D2E]/55 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="animate-pad-modal-in relative flex max-h-[85svh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-4 border-[#a9743f] bg-[#fbf5e6] shadow-[0_20px_60px_rgba(80,50,20,.35)] outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#a9743f]/30 px-6 py-4">
          <h2 className="text-xl font-extrabold tracking-tight text-galli-dark sm:text-2xl">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#a9743f]/15 text-[#7a5226] transition hover:bg-[#a9743f]/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  )
}
