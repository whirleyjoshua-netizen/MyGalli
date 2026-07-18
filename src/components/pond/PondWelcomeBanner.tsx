'use client'

import { X } from 'lucide-react'

export function PondWelcomeBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border mb-6 min-h-[140px] flex items-center"
      style={{ backgroundImage: 'url(/pond/welcome-banner.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      {/* left light scrim for legibility */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/70 to-transparent" />
      <div className="relative p-6 max-w-lg">
        <h2 className="text-xl font-bold text-galli-dark flex items-center gap-2">Welcome to your pond! 🌱</h2>
        <p className="text-sm text-galli-dark/80 mt-1">
          This is where your communities live.<br />
          Start or join one to connect, share, and build together.
        </p>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss welcome banner"
        className="absolute top-3 right-3 p-1.5 rounded-full bg-white/70 hover:bg-white text-galli-dark/70 hover:text-galli-dark transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
