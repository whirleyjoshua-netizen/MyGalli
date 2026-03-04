'use client'

import { useState, useEffect } from 'react'
import { Pen, RotateCw } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { JerseySVG } from './JerseySVG'
import { SignatureCanvas } from './SignatureCanvas'

interface Signature {
  id: string
  name: string
  pathData: string
  color: string
}

interface Props {
  element: CanvasElement
  displayId: string
}

export function PublicJerseyElement({ element, displayId }: Props) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [showSignModal, setShowSignModal] = useState(false)
  const [signatures, setSignatures] = useState<Signature[]>([])
  const [loading, setLoading] = useState(false)

  const number = element.jerseyNumber || '1'
  const name = element.jerseyName || 'PLAYER'
  const primaryColor = element.jerseyPrimaryColor || '#39D98A'
  const secondaryColor = element.jerseySecondaryColor || '#0F3D2E'
  const style = element.jerseyStyle || 'classic'
  const signaturesEnabled = element.jerseySignaturesEnabled !== false

  // Fetch existing signatures
  useEffect(() => {
    if (!signaturesEnabled || !displayId) return
    fetch(`/api/displays/${displayId}/signatures?elementId=${element.id}`)
      .then(res => res.ok ? res.json() : [])
      .then(setSignatures)
      .catch(() => {})
  }, [displayId, element.id, signaturesEnabled])

  const handleSign = async (data: { name: string; pathData: string; color: string }) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/displays/${displayId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, elementId: element.id }),
      })
      if (res.ok) {
        const sig = await res.json()
        setSignatures(prev => [sig, ...prev])
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
      setShowSignModal(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* 3D Flip Container */}
      <div
        className="relative cursor-pointer"
        style={{ perspective: '1000px', width: 280, height: 340 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="relative w-full h-full transition-transform duration-700"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* Front */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="drop-shadow-xl">
              <JerseySVG
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                number={number}
                name={name}
                style={style}
                signatures={signatures.slice(0, 10).map(s => ({
                  pathData: s.pathData,
                  color: s.color,
                }))}
              />
            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl p-6"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              backgroundColor: primaryColor,
            }}
          >
            <div className="text-center" style={{ color: secondaryColor }}>
              <div className="text-6xl font-black mb-2">#{number}</div>
              <div className="text-xl font-bold uppercase tracking-widest mb-4">{name}</div>
              <div className="w-16 h-0.5 mx-auto mb-4" style={{ backgroundColor: secondaryColor, opacity: 0.3 }} />
              {signatures.length > 0 && (
                <div className="text-sm font-medium opacity-70">
                  {signatures.length} signature{signatures.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tap hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <RotateCw className="w-3 h-3" />
        <span>Tap to flip</span>
      </div>

      {/* Sign button */}
      {signaturesEnabled && (
        <button
          onClick={(e) => { e.stopPropagation(); setShowSignModal(true) }}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition shadow-lg shadow-primary/20"
        >
          <Pen className="w-4 h-4" />
          Sign My Jersey
        </button>
      )}

      {/* Signature count */}
      {signatures.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 max-w-xs">
          {signatures.slice(0, 8).map((sig) => (
            <span
              key={sig.id}
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted font-medium"
              style={{ color: sig.color }}
            >
              {sig.name}
            </span>
          ))}
          {signatures.length > 8 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{signatures.length - 8} more
            </span>
          )}
        </div>
      )}

      {/* Signature Modal */}
      {showSignModal && (
        <SignatureCanvas
          onSubmit={handleSign}
          onClose={() => setShowSignModal(false)}
        />
      )}
    </div>
  )
}
