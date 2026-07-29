'use client'

import { useState } from 'react'
import { X, MessageCircle, User, Palette } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { COMMENT_THEMES, type CommentThemeKey } from './comment-themes'

interface CommentElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function CommentElement({ element, onChange, onDelete, isSelected, onSelect }: CommentElementProps) {
  const [showThemes, setShowThemes] = useState(false)

  const title = element.commentTitle || 'Comments'
  const requireName = element.commentRequireName ?? true
  const requireEmail = element.commentRequireEmail ?? false
  const themeKey = (element.commentTheme || 'minimal') as CommentThemeKey
  const theme = COMMENT_THEMES[themeKey] || COMMENT_THEMES.minimal

  return (
    <div className="flex justify-center" onClick={onSelect}>
      <div
        className={`relative group w-full max-w-lg rounded-2xl border-2 transition-all overflow-hidden ${
          isSelected
            ? 'border-blue-500 ring-2 ring-blue-200'
            : 'border-transparent'
        }`}
      >
        {/* Action buttons */}
        {isSelected && (
          <div className="absolute -top-3 right-2 flex items-center gap-1 z-20">
            <button
              onClick={(e) => { e.stopPropagation(); setShowThemes(!showThemes) }}
              className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 transition"
              title="Theme"
            >
              <Palette className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-red-50 transition"
              title="Delete"
            >
              <X className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        )}

        {/* Theme banner */}
        <div
          className="relative px-6 py-5"
          style={{ background: theme.headerGradient }}
        >
          {/* Decorative graphics */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <span className="absolute -top-2 -right-2 text-5xl opacity-20 rotate-12">{theme.graphics[0]}</span>
            <span className="absolute bottom-1 left-4 text-3xl opacity-15 -rotate-6">{theme.graphics[1]}</span>
            {theme.graphics[2] && (
              <span className="absolute top-2 left-1/2 text-2xl opacity-10">{theme.graphics[2]}</span>
            )}
          </div>

          <div className="relative flex items-center gap-2.5">
            <span className="text-2xl">{theme.icon}</span>
            <input
              type="text"
              value={title}
              onChange={(e) => onChange({ commentTitle: e.target.value })}
              className="text-lg font-bold bg-transparent border-none outline-none flex-1"
              style={{ color: theme.headerText }}
              placeholder="Comments"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Card body */}
        <div className="p-5" style={{ background: theme.cardBg }}>
          {/* Preview form */}
          <div className="space-y-3 opacity-50 pointer-events-none">
            {requireName && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <div className="h-9 rounded-lg" style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }} />
                </div>
                {requireEmail && (
                  <div className="flex-1">
                    <div className="h-9 rounded-lg" style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }} />
                  </div>
                )}
              </div>
            )}
            <div className="h-20 rounded-lg" style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }} />
            <div className="h-9 w-28 rounded-lg" style={{ background: theme.accent, opacity: 0.6 }} />
          </div>

          {/* Fake comments */}
          <div className="mt-4 pt-4 space-y-3 opacity-30" style={{ borderTop: `1px solid ${theme.inputBorder}` }}>
            {[1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0" style={{ background: theme.accent }}>
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded" style={{ background: theme.inputBorder }} />
                  <div className="h-3 w-full rounded" style={{ background: theme.inputBg }} />
                  <div className="h-3 w-3/4 rounded" style={{ background: theme.inputBg }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Theme Picker */}
        {showThemes && isSelected && (
          <div
            className="border-t border-slate-200 p-4 bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Choose Theme</div>
            <div className="grid grid-cols-4 gap-2">
              {(Object.keys(COMMENT_THEMES) as CommentThemeKey[]).map((key) => {
                const t = COMMENT_THEMES[key]
                const isActive = key === themeKey
                return (
                  <button
                    key={key}
                    onClick={() => onChange({ commentTheme: key })}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-[4/3] ${
                      isActive ? 'border-blue-500 ring-2 ring-blue-200 scale-105' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="absolute inset-0" style={{ background: t.headerGradient }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl">{t.icon}</span>
                    </div>
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 backdrop-blur-sm">
                      <span className="text-[9px] font-medium text-white block text-center py-0.5">{t.label}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
