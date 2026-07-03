'use client'

import { useState, useEffect } from 'react'
import { X, Copy, Check, Trash2, Link as LinkIcon, ExternalLink } from 'lucide-react'
import { slugify } from '@/lib/utils'
import { SocialShareButtons } from '@/components/share/SocialShareButtons'

interface ShareLink {
  id: string
  code: string
  label: string | null
  isActive: boolean
  clicks: number
  createdAt: string
}

interface ShareDialogProps {
  displayId: string
  pageTitle: string
  published: boolean
  pageUrl: string
  onClose: () => void
}

export function ShareDialog({ displayId, pageTitle, published, pageUrl, onClose }: ShareDialogProps) {
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [newCode, setNewCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Load existing links
  useEffect(() => {
    fetchLinks()
  }, [displayId])

  // Auto-suggest code from title
  useEffect(() => {
    if (pageTitle && !newCode) {
      setNewCode(slugify(pageTitle))
    }
  }, [pageTitle])

  const fetchLinks = async () => {
    try {
      const res = await fetch(`/api/share-links?displayId=${displayId}`, {
      })
      if (res.ok) {
        setLinks(await res.json())
      }
    } finally {
      setLoading(false)
    }
  }

  const createLink = async () => {
    if (!newCode.trim()) return
    setCreating(true)
    setError('')

    try {
      const res = await fetch('/api/share-links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayId, code: newCode.toLowerCase().trim() }),
      })

      if (res.ok) {
        const link = await res.json()
        setLinks((prev) => [link, ...prev])
        setNewCode('')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create link')
      }
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (link: ShareLink) => {
    const res = await fetch(`/api/share-links/${link.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !link.isActive }),
    })

    if (res.ok) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, isActive: !l.isActive } : l))
      )
    }
  }

  const deleteLink = async (link: ShareLink) => {
    const res = await fetch(`/api/share-links/${link.id}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setLinks((prev) => prev.filter((l) => l.id !== link.id))
    }
  }

  const copyLink = (code: string, id: string) => {
    const url = `${window.location.origin}/s/${code}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const getFullUrl = (code: string) => {
    return `${typeof window !== 'undefined' ? window.location.origin : ''}/s/${code}`
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-lg font-semibold">Share Page</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5">
            {/* Share to social (published pages only) */}
            {published && pageUrl && (
              <div className="mb-5 pb-5 border-b border-border">
                <label className="text-sm font-medium text-foreground block mb-2">
                  Share to social
                </label>
                <SocialShareButtons url={pageUrl} title={pageTitle} />
              </div>
            )}

            {/* Unpublished warning */}
            {!published && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                Publish your page first to make share links work.
              </div>
            )}

            {/* Create new link */}
            <div className="mb-5">
              <label className="text-sm font-medium text-foreground block mb-2">
                Create a share link
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    /s/
                  </span>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => {
                      setNewCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                      setError('')
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && createLink()}
                    placeholder="my-page-name"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={createLink}
                  disabled={creating || !newCode.trim()}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {creating ? '...' : 'Create'}
                </button>
              </div>
              {error && (
                <p className="mt-1.5 text-xs text-destructive">{error}</p>
              )}
            </div>

            {/* Existing links */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Your share links
              </label>

              {loading ? (
                <div className="text-sm text-muted-foreground py-4 text-center">Loading...</div>
              ) : links.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                  No share links yet. Create one above.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition ${
                        link.isActive
                          ? 'bg-muted/30 border-border'
                          : 'bg-muted/10 border-border/50 opacity-60'
                      }`}
                    >
                      <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">/s/{link.code}</div>
                        <div className="text-xs text-muted-foreground">
                          {link.clicks} click{link.clicks !== 1 ? 's' : ''}
                          {!link.isActive && ' • Disabled'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Copy */}
                        <button
                          onClick={() => copyLink(link.code, link.id)}
                          className="p-1.5 hover:bg-muted rounded-md transition"
                          title="Copy link"
                        >
                          {copiedId === link.id ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </button>

                        {/* Open */}
                        <a
                          href={getFullUrl(link.code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 hover:bg-muted rounded-md transition"
                          title="Open link"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </a>

                        {/* Toggle active */}
                        <button
                          onClick={() => toggleActive(link)}
                          className={`p-1.5 rounded-md transition text-xs font-medium ${
                            link.isActive
                              ? 'hover:bg-amber-50 text-amber-600'
                              : 'hover:bg-green-50 text-green-600'
                          }`}
                          title={link.isActive ? 'Disable' : 'Enable'}
                        >
                          {link.isActive ? 'Off' : 'On'}
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => deleteLink(link)}
                          className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
