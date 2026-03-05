'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, ExternalLink, Eye, MoreHorizontal, BarChart3, Compass, LogOut, Menu, Layout, Clock, Settings, Pin, PinOff, GripVertical, Trophy, Trash2, ImageIcon, X } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAuthStore } from '@/lib/store'
import { BackgroundSettings } from '@/components/canvas/BackgroundSettings'
import { getBackgroundStyles, DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import type { BackgroundConfig } from '@/lib/types/background'
import type { DashboardPrefs } from '@/lib/types/dashboard'

interface Display {
  id: string
  title: string
  slug: string
  published: boolean
  views: number
  updatedAt: string
  coverImage?: string | null
  _count: { elements: number }
}

const GRADIENTS = [
  'from-gallio/20 via-gallio-aqua/10 to-gallio-violet/5',
  'from-gallio-aqua/20 via-gallio-violet/10 to-gallio/5',
  'from-gallio-violet/20 via-gallio/10 to-gallio-aqua/5',
  'from-gallio/15 via-gallio-aqua/8 to-transparent',
  'from-gallio-violet/15 via-gallio/8 to-transparent',
  'from-gallio-aqua/15 via-gallio-violet/8 to-transparent',
]

// Sortable display card wrapper
function SortableDisplayCard({
  display,
  isPinned,
  gradient,
  onTogglePin,
  onOpenMenu,
  isMenuOpen,
  onCloseMenu,
  onDelete,
  onCoverChange,
  user,
  timeAgo,
}: {
  display: Display
  isPinned: boolean
  gradient: string
  onTogglePin: (id: string) => void
  onOpenMenu: (id: string) => void
  isMenuOpen: boolean
  onCloseMenu: () => void
  onDelete: (id: string) => void
  onCoverChange: (id: string, file: File | null) => void
  user: { username?: string } | null
  timeAgo: (dateStr: string) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: display.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-3 left-3 z-10 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-background/60 backdrop-blur-sm"
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>

      {/* Pin indicator */}
      {isPinned && (
        <div className="absolute top-3 left-12 z-10">
          <Pin className="w-3.5 h-3.5 text-gallio rotate-[-30deg]" />
        </div>
      )}

      <Link
        href={`/editor?id=${display.id}`}
        className="relative overflow-hidden border border-border rounded-xl hover:border-gallio/40 hover:shadow-lg hover:shadow-gallio/10 transition-all block bg-background"
      >
        {/* Cover image or gradient preview area */}
        <div className={`h-28 relative ${display.coverImage ? '' : `bg-gradient-to-br ${gradient}`}`}>
          {display.coverImage && (
            <img
              src={display.coverImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          {/* Status badge */}
          <div className="absolute top-3 right-3">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${
                display.published
                  ? 'bg-gallio/20 text-gallio-dark border border-gallio/20'
                  : 'bg-background/60 text-muted-foreground border border-border/50'
              }`}
            >
              {display.published ? 'Published' : 'Draft'}
            </span>
          </div>
          {/* Element count overlay */}
          <div className={`absolute bottom-3 left-4 flex items-center gap-1.5 text-xs ${display.coverImage ? 'text-white drop-shadow-md' : 'text-muted-foreground'}`}>
            <Layout className="w-3 h-3" />
            {display._count.elements} elements
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-background to-transparent" />
        </div>

        <div className="px-4 pb-4 pt-1">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold group-hover:text-primary transition-colors truncate pr-2">
              {display.title}
            </h3>
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onOpenMenu(display.id)
              }}
              className="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            >
              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {display.views}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(display.updatedAt)}
              </span>
            </div>
            {display.published && (
              <span
                onClick={(e) => { e.preventDefault(); window.open(`/${user?.username}/${display.slug}`, '_blank') }}
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                Live
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Card dropdown menu */}
      {isMenuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onCloseMenu} />
          <div className="absolute right-4 top-[7.5rem] z-50 w-44 bg-background border border-border rounded-xl shadow-lg py-1 overflow-hidden">
            <button
              onClick={() => { onTogglePin(display.id); onCloseMenu() }}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
            >
              {isPinned ? (
                <>
                  <PinOff className="w-4 h-4" />
                  Unpin
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4" />
                  Pin to top
                </>
              )}
            </button>
            {display.published && (
              <button
                onClick={() => { window.open(`/${user?.username}/${display.slug}`, '_blank'); onCloseMenu() }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                View live
              </button>
            )}
            <label className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors cursor-pointer">
              <ImageIcon className="w-4 h-4" />
              {display.coverImage ? 'Change cover' : 'Add cover'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) { onCoverChange(display.id, file); onCloseMenu() }
                  e.target.value = ''
                }}
              />
            </label>
            {display.coverImage && (
              <button
                onClick={() => { onCoverChange(display.id, null); onCloseMenu() }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted w-full transition-colors"
              >
                <X className="w-4 h-4" />
                Remove cover
              </button>
            )}
            <div className="border-t border-border">
              <button
                onClick={() => { onDelete(display.id); onCloseMenu() }}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 w-full transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [displays, setDisplays] = useState<Display[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cardMenuOpen, setCardMenuOpen] = useState<string | null>(null)
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false)
  const [dashboardPrefs, setDashboardPrefs] = useState<DashboardPrefs>({})
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    fetchDisplays()
    fetchDashboardPrefs()
  }, [router])

  const fetchDisplays = async () => {
    try {
      const res = await fetch('/api/displays')
      if (res.ok) {
        const data = await res.json()
        setDisplays(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchDashboardPrefs = async () => {
    try {
      const res = await fetch('/api/dashboard-prefs')
      if (res.ok) {
        const data = await res.json()
        setDashboardPrefs(data || {})
      }
    } catch {}
  }

  const savePrefs = useCallback(async (prefs: DashboardPrefs) => {
    setDashboardPrefs(prefs)
    try {
      await fetch('/api/dashboard-prefs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
    } catch {}
  }, [])

  const createDisplay = () => {
    router.push('/editor')
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

  // Sorted displays: custom order + pinned first
  const sortedDisplays = useMemo(() => {
    const order = dashboardPrefs.displayOrder || []
    const pinned = new Set(dashboardPrefs.pinnedDisplayIds || [])

    // Start with displays in custom order, append any not yet ordered
    const ordered = [
      ...order.filter(id => displays.some(d => d.id === id)).map(id => displays.find(d => d.id === id)!),
      ...displays.filter(d => !order.includes(d.id)),
    ]

    // Stable partition: pinned first, then unpinned
    return [
      ...ordered.filter(d => pinned.has(d.id)),
      ...ordered.filter(d => !pinned.has(d.id)),
    ]
  }, [displays, dashboardPrefs.displayOrder, dashboardPrefs.pinnedDisplayIds])

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCardId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const currentOrder = sortedDisplays.map(d => d.id)
    const oldIndex = currentOrder.indexOf(active.id as string)
    const newIndex = currentOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = [...currentOrder]
    const [removed] = newOrder.splice(oldIndex, 1)
    newOrder.splice(newIndex, 0, removed)

    savePrefs({ ...dashboardPrefs, displayOrder: newOrder })
  }

  // Pin/unpin
  const togglePin = useCallback((displayId: string) => {
    const pinned = new Set(dashboardPrefs.pinnedDisplayIds || [])
    if (pinned.has(displayId)) {
      pinned.delete(displayId)
    } else {
      pinned.add(displayId)
    }
    savePrefs({ ...dashboardPrefs, pinnedDisplayIds: Array.from(pinned) })
  }, [dashboardPrefs, savePrefs])

  // Cover image upload/remove
  const handleCoverChange = useCallback(async (displayId: string, file: File | null) => {
    try {
      let coverImage: string | null = null

      if (file) {
        // Upload the file
        const formData = new FormData()
        formData.append('file', file)
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
        if (!uploadRes.ok) return
        const { url } = await uploadRes.json()
        coverImage = url
      }

      // Update the display
      const res = await fetch(`/api/displays/${displayId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coverImage }),
      })

      if (res.ok) {
        setDisplays(prev => prev.map(d => d.id === displayId ? { ...d, coverImage } : d))
      }
    } catch {}
  }, [])

  // Delete display
  const deleteDisplay = useCallback(async (displayId: string) => {
    const display = displays.find(d => d.id === displayId)
    if (!display) return
    if (!window.confirm(`Delete "${display.title}"? This cannot be undone.`)) return

    try {
      const res = await fetch(`/api/displays/${displayId}`, { method: 'DELETE' })
      if (res.ok) {
        setDisplays(prev => prev.filter(d => d.id !== displayId))
      }
    } catch {}
  }, [displays])

  // Background change
  const handleBgChange = useCallback((config: BackgroundConfig) => {
    savePrefs({ ...dashboardPrefs, background: config })
  }, [dashboardPrefs, savePrefs])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const totalViews = displays.reduce((sum, d) => sum + d.views, 0)
  const publishedCount = displays.filter(d => d.published).length
  const activeDisplay = activeCardId ? displays.find(d => d.id === activeCardId) : null

  return (
    <div className="min-h-screen relative">

      {/* Nav bar */}
      <nav className="sticky top-0 z-30 bg-gradient-to-r from-gallio/15 via-gallio-aqua/10 to-gallio-violet/15 backdrop-blur-xl border-b border-gallio/20 shadow-md shadow-gallio/10">
        <div className="px-6 py-3.5 flex items-center">
          <div className="flex-1" />
          <Link href="/" className="flex items-center gap-3 text-2xl font-extrabold">
            <Image src="/gallio-frog.svg" alt="" width={38} height={38} className="drop-shadow-sm" />
            <span className="text-gallio-gradient tracking-tight">Gallio</span>
          </Link>
          <div className="flex-1 flex justify-end gap-2">
            <button
              onClick={() => setBgSettingsOpen(true)}
              className="p-2.5 bg-gallio/10 hover:bg-gallio/20 rounded-xl transition-all hover:scale-105"
              title="Dashboard background"
            >
              <Settings className="w-5 h-5 text-gallio" />
            </button>
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2.5 bg-gallio-violet/10 hover:bg-gallio-violet/20 rounded-xl transition-all hover:scale-105"
              >
                <Menu className="w-5 h-5 text-gallio-violet" />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                      <p className="text-sm font-medium">{user?.name || user?.username}</p>
                      <p className="text-xs text-muted-foreground">@{user?.username}</p>
                    </div>
                    <Link href="/explore" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Compass className="w-4 h-4" />
                      Explore
                    </Link>
                    <Link href="/analytics" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <BarChart3 className="w-4 h-4" />
                      Analytics
                    </Link>
                    <div className="border-t border-border">
                      <button onClick={() => { logout(); setMenuOpen(false) }} className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 w-full transition-colors">
                        <LogOut className="w-4 h-4" />
                        Log out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero header */}
      <header className="relative overflow-hidden">
        <div className="bg-gradient-to-br from-gallio/10 via-gallio-aqua/5 to-gallio-violet/10">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-1">
                  Welcome back{user?.name ? `, ${user.name}` : ''}
                </h1>
                <p className="text-muted-foreground">
                  Your living gallery — {displays.length} display{displays.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/new-kit"
                  className="flex items-center gap-2 px-5 py-3 bg-gallio/10 text-gallio-dark border border-gallio/20 rounded-full font-medium hover:bg-gallio/20 hover:shadow-lg hover:shadow-gallio/15 hover:scale-[1.02] transition-all"
                >
                  <Trophy className="w-4 h-4 text-gallio" />
                  New Kit Page
                </Link>
                <button
                  onClick={createDisplay}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-lg hover:shadow-gallio/25 hover:scale-[1.02] transition-all"
                >
                  <Plus className="w-4 h-4" />
                  New Page
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="mt-8 flex gap-6">
              <div className="flex items-center gap-2 px-4 py-2 bg-background/60 backdrop-blur-sm rounded-full border border-border/50">
                <Layout className="w-4 h-4 text-gallio" />
                <span className="text-sm font-medium">{displays.length} pages</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-background/60 backdrop-blur-sm rounded-full border border-border/50">
                <Eye className="w-4 h-4 text-gallio-aqua" />
                <span className="text-sm font-medium">{totalViews} total views</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-background/60 backdrop-blur-sm rounded-full border border-border/50">
                <ExternalLink className="w-4 h-4 text-gallio-violet" />
                <span className="text-sm font-medium">{publishedCount} published</span>
              </div>
            </div>
          </div>
        </div>
        {/* Fade edge */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-background to-transparent" />
      </header>

      {/* Canvas area — background only applies here */}
      <div className="relative min-h-[50vh]">
        {dashboardPrefs.background ? (
          <div className="absolute inset-0 -z-10" style={getBackgroundStyles(dashboardPrefs.background)} />
        ) : (
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gallio/[0.04] rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gallio-violet/[0.04] rounded-full blur-3xl" />
          </div>
        )}
        <main className="max-w-6xl mx-auto px-6 py-8 relative z-10">
        {displays.length === 0 ? (
          <div className="text-center py-24">
            <Image src="/gallio-frog.svg" alt="" width={64} height={64} className="mx-auto mb-6 opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Your gallery is empty</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first display — add elements, collect responses, and share it with the world.
            </p>
            <button
              onClick={createDisplay}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:shadow-lg hover:shadow-gallio/25 transition-all"
            >
              Create your first page
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedDisplays.map(d => d.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {/* New page card — always first, not sortable */}
                <button
                  onClick={createDisplay}
                  className="group border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center py-12 hover:border-gallio/40 hover:bg-gallio/[0.03] transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-gallio/10 flex items-center justify-center mb-3 group-hover:bg-gallio/20 group-hover:scale-110 transition-all">
                    <Plus className="w-6 h-6 text-gallio" />
                  </div>
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    New Page
                  </span>
                </button>

                {/* Sortable display cards */}
                {sortedDisplays.map((display, i) => (
                  <SortableDisplayCard
                    key={display.id}
                    display={display}
                    isPinned={(dashboardPrefs.pinnedDisplayIds || []).includes(display.id)}
                    gradient={GRADIENTS[i % GRADIENTS.length]}
                    onTogglePin={togglePin}
                    onOpenMenu={(id) => setCardMenuOpen(cardMenuOpen === id ? null : id)}
                    isMenuOpen={cardMenuOpen === display.id}
                    onCloseMenu={() => setCardMenuOpen(null)}
                    onDelete={deleteDisplay}
                    onCoverChange={handleCoverChange}
                    user={user}
                    timeAgo={timeAgo}
                  />
                ))}
              </div>
            </SortableContext>

            {/* Drag overlay */}
            <DragOverlay>
              {activeDisplay && (
                <div className="opacity-80 shadow-2xl rounded-xl bg-background border border-gallio/30 w-[300px] overflow-hidden pointer-events-none">
                  <div className={`h-20 bg-gradient-to-br ${GRADIENTS[0]}`} />
                  <div className="px-4 py-3">
                    <h3 className="text-sm font-semibold truncate">{activeDisplay.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{activeDisplay.views} views</p>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
        </main>
      </div>

      {/* Background settings modal */}
      <BackgroundSettings
        isOpen={bgSettingsOpen}
        onClose={() => setBgSettingsOpen(false)}
        config={dashboardPrefs.background || DEFAULT_BACKGROUND_CONFIG}
        onChange={handleBgChange}
      />

    </div>
  )
}
