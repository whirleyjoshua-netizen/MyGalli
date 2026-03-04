'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { GOOGLE_FONTS, loadGoogleFont } from '@/lib/fonts'
import type { GoogleFont } from '@/lib/fonts'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'sans-serif', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'display', label: 'Display' },
  { id: 'handwriting', label: 'Script' },
  { id: 'monospace', label: 'Mono' },
] as const

interface FontPickerProps {
  value: string | undefined
  onChange: (fontFamily: string) => void
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Focus search on open
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus()
    }
  }, [isOpen])

  // Filter fonts
  const filtered = GOOGLE_FONTS.filter((font) => {
    if (category !== 'all' && font.category !== category) return false
    if (search && !font.family.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Lazy-load fonts as they scroll into view
  const observerRef = useRef<IntersectionObserver | null>(null)

  const fontItemRef = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const family = (entry.target as HTMLElement).dataset.family
              if (family) loadGoogleFont(family, [400])
            }
          })
        },
        { root: listRef.current, rootMargin: '100px' }
      )
    }
    observerRef.current.observe(node)
  }, [])

  // Cleanup observer on close
  useEffect(() => {
    if (!isOpen && observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
  }, [isOpen])

  // Load selected font for display
  useEffect(() => {
    if (value) loadGoogleFont(value, [400])
  }, [value])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
        }}
        className="w-full flex items-center justify-between px-2.5 py-1.5 text-sm bg-muted border border-border rounded-lg hover:border-muted-foreground/50 transition"
      >
        <span
          className="truncate"
          style={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
        >
          {value || 'Inter (default)'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-background border border-border rounded-xl shadow-2xl z-[60] overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search fonts..."
                className="w-full pl-8 pr-8 py-1.5 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSearch('')
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-border overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setCategory(cat.id)
                }}
                className={`px-2 py-0.5 text-[11px] font-medium rounded-md whitespace-nowrap transition ${
                  category === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Font list */}
          <div ref={listRef} className="max-h-64 overflow-y-auto">
            {/* Default option */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setIsOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition flex items-center justify-between ${
                !value ? 'bg-primary/10 text-primary font-medium' : ''
              }`}
            >
              <span>Inter (default)</span>
              {!value && <span className="text-xs text-primary">Active</span>}
            </button>

            {filtered.map((font) => (
              <button
                key={font.family}
                ref={fontItemRef}
                data-family={font.family}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(font.family)
                  setIsOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition flex items-center justify-between ${
                  value === font.family ? 'bg-primary/10 text-primary font-medium' : ''
                }`}
              >
                <span style={{ fontFamily: `"${font.family}", sans-serif` }}>
                  {font.family}
                </span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                  {font.category}
                </span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No fonts found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
