'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendingUp, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { TrackerChart } from '@/components/tracker/TrackerChart'
import { TrackerSummaryCard } from '@/components/tracker/TrackerSummaryCard'
import { TrackerTimeFilter } from '@/components/tracker/TrackerTimeFilter'
import { TrackerEntryModal } from './TrackerEntryModal'
import { getKit } from '@/lib/kits/registry'
import { computeTrackerSummary, entriesToChartData, getTimeRangeFilter } from '@/lib/kits/tracker-utils'
import type { TrackerConfig } from '@/lib/kits/registry'
// Ensure athlete kit is registered
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'

interface TrackerElementProps {
  element: {
    id: string
    trackerKitId?: string
    trackerConfigId?: string
    trackerTitle?: string
    trackerColor?: string
    trackerChartType?: 'line' | 'bar'
    trackerShowSummary?: boolean
    trackerTimeRange?: string
  }
  displayId: string
  onChange: (updates: Record<string, any>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function TrackerElement({ element, displayId, onChange, onDelete, isSelected, onSelect }: TrackerElementProps) {
  const { token } = useAuthStore()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [timeRange, setTimeRange] = useState(element.trackerTimeRange || 'all')

  const kit = element.trackerKitId ? getKit(element.trackerKitId) : null
  const trackerConfig = kit?.trackers.find(t => t.id === element.trackerConfigId)

  const color = element.trackerColor || trackerConfig?.color || '#39D98A'
  const chartType = element.trackerChartType || trackerConfig?.visualization || 'line'
  const title = element.trackerTitle || trackerConfig?.label || 'Tracker'
  const primaryField = trackerConfig?.fields.find(f => f.required && f.type === 'number')?.key || trackerConfig?.fields[0]?.key || 'value'

  const fetchEntries = useCallback(async () => {
    if (!token || !displayId) return
    setLoading(true)
    try {
      const from = getTimeRangeFilter(timeRange)
      const params = new URLSearchParams({ displayId, trackerId: element.id })
      if (from) params.set('from', from.toISOString())

      const res = await fetch(`/api/tracker-entries?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setEntries(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    } finally {
      setLoading(false)
    }
  }, [token, displayId, element.id, timeRange])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleDeleteEntry = async (entryId: string) => {
    if (!token) return
    try {
      await fetch(`/api/tracker-entries/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setEntries(prev => prev.filter(e => e.id !== entryId))
    } catch (err) {
      console.error('Failed to delete entry:', err)
    }
  }

  const summary = computeTrackerSummary(entries, primaryField)
  const chartData = entriesToChartData(entries, primaryField)

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-semibold">{title}</span>
          <span className="text-xs text-muted-foreground">({entries.length} entries)</span>
        </div>
        <div className="flex items-center gap-2">
          <TrackerTimeFilter
            value={timeRange}
            onChange={(range) => {
              setTimeRange(range)
              onChange({ trackerTimeRange: range })
            }}
          />
          <button
            onClick={(e) => { e.stopPropagation(); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Entry
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground mb-1">Start Tracking</p>
            <p className="text-xs text-muted-foreground/70 mb-4">Add your first {title.toLowerCase()} entry to see your progress.</p>
            <button
              onClick={(e) => { e.stopPropagation(); setShowModal(true) }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              <Plus className="w-4 h-4" />
              Add First Entry
            </button>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {element.trackerShowSummary !== false && (
              <TrackerSummaryCard
                summary={summary}
                color={color}
                unit={trackerConfig?.fields.find(f => f.key === primaryField)?.unit}
              />
            )}

            {/* Chart */}
            <TrackerChart data={chartData} chartType={chartType} color={color} />

            {/* History toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory) }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition w-full justify-center"
            >
              {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showHistory ? 'Hide' : 'View'} History
            </button>

            {/* History list */}
            {showHistory && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {[...entries].reverse().map(entry => (
                  <div key={entry.id} className="flex items-center justify-between px-3 py-2 bg-muted/50 rounded-lg text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">
                        {new Date(entry.recordedAt).toLocaleDateString()}
                      </span>
                      <span className="font-medium">
                        {typeof entry.value === 'object'
                          ? Object.entries(entry.value).map(([k, v]) => `${k}: ${v}`).join(', ')
                          : entry.value}
                      </span>
                      {entry.note && <span className="text-muted-foreground italic">{entry.note}</span>}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteEntry(entry.id) }}
                      className="p-1 text-muted-foreground hover:text-red-500 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete button */}
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}

      {/* Entry modal */}
      {showModal && trackerConfig && token && (
        <TrackerEntryModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          trackerLabel={trackerConfig.label}
          fields={trackerConfig.fields}
          displayId={displayId}
          trackerId={element.id}
          category={trackerConfig.category}
          token={token}
          onEntryAdded={fetchEntries}
        />
      )}
    </div>
  )
}
