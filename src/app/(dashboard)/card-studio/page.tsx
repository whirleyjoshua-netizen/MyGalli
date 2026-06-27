'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'
import { ArrowLeft, ExternalLink, Code2, Layers, Search, Plus, Trash2, BookOpen, X, Library } from 'lucide-react'
import { CARD_PROVIDERS } from '@/lib/cards/registry'
import type { CardProviderConfig } from '@/lib/cards/registry'
import { VouchCard } from '@/components/elements/cards/VouchCard'
import { IframeCardRenderer } from '@/components/elements/cards/IframeCardRenderer'

const BUILTIN_RENDERERS: Record<string, React.ComponentType<{ data: Record<string, any>; style?: 'default' | 'compact' | 'detailed' }>> = {
  vouch: VouchCard,
}

interface LibraryItem {
  id: string
  provider: string
  name: string
  data: Record<string, any>
  style: string
  createdAt: string
  updatedAt: string
}

function CardPreview({ provider, data, style }: { provider: CardProviderConfig; data?: Record<string, any>; style?: string }) {
  const cardData = data || provider.defaultData
  const cardStyle = (style || 'default') as 'default' | 'compact' | 'detailed'

  if (provider.type === 'external' && provider.iframeUrl) {
    return (
      <IframeCardRenderer
        url={provider.iframeUrl}
        data={cardData}
        style={cardStyle}
      />
    )
  }

  const Renderer = BUILTIN_RENDERERS[provider.id]
  if (Renderer) {
    return <Renderer data={cardData} style={cardStyle} />
  }

  return (
    <div className="p-8 rounded-lg bg-muted/30 border border-border text-center text-sm text-muted-foreground">
      No preview available
    </div>
  )
}

export default function CardStudioPage() {
  const [activeTab, setActiveTab] = useState<'browse' | 'library'>('browse')
  const [search, setSearch] = useState('')
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [previewStyle, setPreviewStyle] = useState<'default' | 'compact' | 'detailed'>('default')

  // Library state
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)

  // Add to library modal
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addModalProvider, setAddModalProvider] = useState<string | null>(null)
  const [addModalName, setAddModalName] = useState('')
  const [addingSaving, setAddingSaving] = useState(false)

  const providers = Object.values(CARD_PROVIDERS)
  const filtered = providers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  const filteredLibrary = libraryItems.filter(item => {
    const provider = CARD_PROVIDERS[item.provider]
    const providerName = provider?.name || item.provider
    return providerName.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase())
  })

  const selected = selectedCard ? CARD_PROVIDERS[selectedCard] : null

  // Fetch library
  const fetchLibrary = useCallback(async () => {
    setLibraryLoading(true)
    try {
      const res = await fetch('/api/card-library')
      if (res.ok) {
        const data = await res.json()
        setLibraryItems(data)
      }
    } catch {} finally {
      setLibraryLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary])

  // Add to library
  const handleAddToLibrary = async () => {
    if (!addModalProvider || !addModalName.trim()) return
    setAddingSaving(true)
    try {
      const provider = CARD_PROVIDERS[addModalProvider]
      const res = await fetch('/api/card-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: addModalProvider,
          name: addModalName.trim(),
          data: provider?.defaultData || {},
          style: 'default',
        }),
      })
      if (res.ok) {
        await fetchLibrary()
        setAddModalOpen(false)
        setAddModalProvider(null)
        setAddModalName('')
        setActiveTab('library')
      }
    } catch {} finally {
      setAddingSaving(false)
    }
  }

  // Delete from library
  const handleDeleteLibraryItem = async (id: string) => {
    try {
      await fetch(`/api/card-library/${id}`, { method: 'DELETE' })
      setLibraryItems(prev => prev.filter(item => item.id !== id))
    } catch {}
  }

  const openAddModal = (providerId: string) => {
    const provider = CARD_PROVIDERS[providerId]
    setAddModalProvider(providerId)
    setAddModalName(provider?.name || '')
    setAddModalOpen(true)
  }

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days}d ago`
    return `${Math.floor(days / 30)}mo ago`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-gradient-to-r from-galli/15 via-galli-aqua/10 to-galli-violet/15 backdrop-blur-xl border-b border-galli/20 shadow-md shadow-galli/10">
        <div className="px-6 py-3.5 flex items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex-1 flex justify-center">
            <Link href="/" className="flex items-center text-2xl">
              <Wordmark />
            </Link>
          </div>
          <div className="w-[140px]" />
        </div>
      </nav>

      {/* Header */}
      <header className="relative overflow-hidden">
        <div className="bg-gradient-to-br from-galli/10 via-galli-aqua/5 to-galli-violet/10">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-galli/10 rounded-xl">
                <Layers className="w-6 h-6 text-galli" />
              </div>
              <h1 className="text-3xl font-bold">Card Studio</h1>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Browse app cards, add them to your library, then use them on any page.
            </p>

            {/* Tab switcher + Search row */}
            <div className="mt-6 flex items-center gap-4 flex-wrap">
              {/* Tabs */}
              <div className="flex bg-muted/50 rounded-full p-1 border border-border/50">
                <button
                  onClick={() => { setActiveTab('browse'); setSelectedCard(null) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === 'browse'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Browse
                </button>
                <button
                  onClick={() => { setActiveTab('library'); setSelectedCard(null) }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeTab === 'library'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Library className="w-4 h-4" />
                  My Library
                  {libraryItems.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-galli/15 text-galli rounded-full">
                      {libraryItems.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Search */}
              <div className="flex-1 max-w-md relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={activeTab === 'browse' ? 'Search cards...' : 'Search library...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-background/60 backdrop-blur-sm border border-border/50 rounded-full text-sm outline-none focus:ring-2 focus:ring-galli/30 focus:border-galli/30 transition-all"
                />
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 flex gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-background/60 backdrop-blur-sm rounded-full border border-border/50">
                <Layers className="w-4 h-4 text-galli" />
                <span className="text-sm font-medium">{providers.length} available</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-background/60 backdrop-blur-sm rounded-full border border-border/50">
                <Library className="w-4 h-4 text-galli-violet" />
                <span className="text-sm font-medium">{libraryItems.length} in library</span>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'browse' && selected ? (
          // Browse detail view
          <div>
            <button
              onClick={() => setSelectedCard(null)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to all cards
            </button>

            <div className="grid md:grid-cols-2 gap-8">
              {/* Preview */}
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Preview</h2>
                  <div className="flex gap-1">
                    {(['default', 'compact', 'detailed'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setPreviewStyle(s)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition capitalize ${
                          previewStyle === s
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted border-border hover:border-muted-foreground'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-6 bg-muted/20 border border-border rounded-xl">
                  <CardPreview provider={selected} style={previewStyle} />
                </div>
              </div>

              {/* Info */}
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-2xl font-bold">{selected.name}</h2>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    selected.type === 'builtin'
                      ? 'bg-galli/10 text-galli border border-galli/20'
                      : 'bg-galli-violet/10 text-galli-violet border border-galli-violet/20'
                  }`}>
                    {selected.type === 'builtin' ? 'Built-in' : 'External'}
                  </span>
                </div>
                <p className="text-muted-foreground mb-6">{selected.description}</p>

                {/* Add to Library button */}
                <button
                  onClick={() => openAddModal(selected.id)}
                  className="flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-lg hover:shadow-galli/25 hover:scale-[1.02] transition-all mb-6"
                >
                  <Plus className="w-4 h-4" />
                  Add to Library
                </button>

                {/* Fields */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold mb-3">Configurable Fields</h3>
                  <div className="space-y-2">
                    {selected.fields.map(field => (
                      <div key={field.key} className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 rounded-lg border border-border/50">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground">
                          {field.key}
                        </span>
                        <span className="text-sm flex-1">{field.label}</span>
                        <span className="text-xs text-muted-foreground capitalize">{field.type}</span>
                        {field.required && (
                          <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded-full">required</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* How to use */}
                <div className="bg-muted/20 border border-border rounded-xl p-5">
                  <h3 className="text-sm font-semibold mb-2">How to use</h3>
                  <p className="text-sm text-muted-foreground">
                    Add this card to your library, then open a page in the editor and type <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">/</kbd> to insert an <strong>App Card</strong> from your library.
                  </p>
                </div>

                {selected.type === 'external' && (
                  <div className="mt-4 bg-galli-violet/5 border border-galli-violet/20 rounded-xl p-5">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-galli-violet" />
                      Developer Info
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      This card runs in a sandboxed iframe using the Galli Card SDK.
                    </p>
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded block overflow-x-auto">
                      {selected.iframeUrl}
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'browse' ? (
          // Browse gallery
          <div>
            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No cards found matching &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map(provider => (
                  <button
                    key={provider.id}
                    onClick={() => { setSelectedCard(provider.id); setPreviewStyle('default') }}
                    className="group text-left border border-border rounded-xl overflow-hidden hover:border-galli/40 hover:shadow-lg hover:shadow-galli/10 transition-all bg-background"
                  >
                    <div className="p-4 bg-muted/20 border-b border-border min-h-[160px] flex items-center justify-center">
                      <div className="w-full max-w-[280px] transform scale-[0.85] origin-center pointer-events-none">
                        <CardPreview provider={provider} />
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold group-hover:text-galli transition-colors">
                          {provider.name}
                        </h3>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                          provider.type === 'builtin'
                            ? 'bg-galli/10 text-galli'
                            : 'bg-galli-violet/10 text-galli-violet'
                        }`}>
                          {provider.type === 'builtin' ? 'Built-in' : 'External'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{provider.description}</p>
                      <div className="mt-3 text-xs text-muted-foreground">
                        {provider.fields.length} configurable field{provider.fields.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </button>
                ))}

                {/* Build your own */}
                <div className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center p-8 hover:border-galli/40 hover:bg-galli/[0.02] transition-all min-h-[300px]">
                  <div className="w-14 h-14 rounded-full bg-galli/10 flex items-center justify-center mb-4">
                    <Code2 className="w-7 h-7 text-galli" />
                  </div>
                  <h3 className="font-semibold mb-1">Build Your Own</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-[200px] mb-4">
                    Create custom cards using the Galli Card SDK
                  </p>
                  <span className="text-xs text-galli font-medium">
                    See /sdk/example-card.html
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Library tab
          <div>
            {libraryLoading ? (
              <div className="text-center py-20 text-muted-foreground">Loading library...</div>
            ) : filteredLibrary.length === 0 ? (
              <div className="text-center py-20">
                {search ? (
                  <>
                    <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">No library cards matching &ldquo;{search}&rdquo;</p>
                  </>
                ) : (
                  <>
                    <Library className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold mb-2">Your library is empty</h2>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Browse available cards and add them to your library. Then use them on any page via the <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">/</kbd> menu.
                    </p>
                    <button
                      onClick={() => setActiveTab('browse')}
                      className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-lg hover:shadow-galli/25 transition-all"
                    >
                      Browse Cards
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredLibrary.map(item => {
                  const provider = CARD_PROVIDERS[item.provider]
                  if (!provider) return null
                  return (
                    <div
                      key={item.id}
                      className="group border border-border rounded-xl overflow-hidden bg-background hover:border-galli/40 hover:shadow-lg hover:shadow-galli/10 transition-all"
                    >
                      {/* Preview */}
                      <div className="p-4 bg-muted/20 border-b border-border min-h-[160px] flex items-center justify-center relative">
                        <div className="w-full max-w-[280px] transform scale-[0.85] origin-center pointer-events-none">
                          <CardPreview provider={provider} data={item.data as Record<string, any>} style={item.style} />
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteLibraryItem(item.id)}
                          className="absolute top-3 right-3 p-1.5 bg-background/80 border border-border rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Info */}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{item.name}</h3>
                          <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0 ${
                            provider.type === 'builtin'
                              ? 'bg-galli/10 text-galli'
                              : 'bg-galli-violet/10 text-galli-violet'
                          }`}>
                            {provider.name}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            Added {timeAgo(item.createdAt)}
                          </span>
                          <span className="text-xs text-muted-foreground capitalize">
                            {item.style} style
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add to Library modal */}
      {addModalOpen && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setAddModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Add to Library</h3>
                <button onClick={() => setAddModalOpen(false)} className="p-1 hover:bg-muted rounded-lg transition">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {addModalProvider && CARD_PROVIDERS[addModalProvider] && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                    CARD_PROVIDERS[addModalProvider].type === 'builtin'
                      ? 'bg-galli/10 text-galli'
                      : 'bg-galli-violet/10 text-galli-violet'
                  }`}>
                    {CARD_PROVIDERS[addModalProvider].name}
                  </span>
                  <span className="text-sm text-muted-foreground">{CARD_PROVIDERS[addModalProvider].description}</span>
                </div>
              )}

              <label className="text-sm font-medium block mb-1.5">Card Name</label>
              <input
                type="text"
                value={addModalName}
                onChange={e => setAddModalName(e.target.value)}
                placeholder="e.g. My LinkedIn Card"
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-galli/30 mb-4"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddToLibrary()}
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setAddModalOpen(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToLibrary}
                  disabled={!addModalName.trim() || addingSaving}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:shadow-lg transition disabled:opacity-50"
                >
                  {addingSaving ? 'Adding...' : 'Add to Library'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
