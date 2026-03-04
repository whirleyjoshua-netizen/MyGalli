'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp } from 'lucide-react'
import { TrackerChart } from '@/components/tracker/TrackerChart'
import { TrackerSummaryCard } from '@/components/tracker/TrackerSummaryCard'
import { TrackerTimeFilter } from '@/components/tracker/TrackerTimeFilter'
import { getKit } from '@/lib/kits/registry'
import { computeTrackerSummary, entriesToChartData, getTimeRangeFilter } from '@/lib/kits/tracker-utils'
import '@/lib/kits/athlete-kit'
import '@/lib/kits/resume-kit'

interface PublicTrackerElementProps {
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
}

export function PublicTrackerElement({ element, displayId }: PublicTrackerElementProps) {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState(element.trackerTimeRange || 'all')

  const kit = element.trackerKitId ? getKit(element.trackerKitId) : null
  const trackerConfig = kit?.trackers.find(t => t.id === element.trackerConfigId)

  const color = element.trackerColor || trackerConfig?.color || '#39D98A'
  const chartType = element.trackerChartType || trackerConfig?.visualization || 'line'
  const title = element.trackerTitle || trackerConfig?.label || 'Tracker'
  const primaryField = trackerConfig?.fields.find(f => f.required && f.type === 'number')?.key || trackerConfig?.fields[0]?.key || 'value'

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const from = getTimeRangeFilter(timeRange)
      const params = new URLSearchParams({ displayId, trackerId: element.id })
      if (from) params.set('from', from.toISOString())

      const res = await fetch(`/api/tracker-entries/public?${params}`)
      if (res.ok) {
        setEntries(await res.json())
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err)
    } finally {
      setLoading(false)
    }
  }, [displayId, element.id, timeRange])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const summary = computeTrackerSummary(entries, primaryField)
  const chartData = entriesToChartData(entries, primaryField)

  if (loading) {
    return <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading tracker...</div>
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 p-6 text-center">
        <TrendingUp className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No {title.toLowerCase()} data yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <TrackerTimeFilter value={timeRange} onChange={setTimeRange} />
      </div>
      <div className="p-4 space-y-4">
        {element.trackerShowSummary !== false && (
          <TrackerSummaryCard
            summary={summary}
            color={color}
            unit={trackerConfig?.fields.find(f => f.key === primaryField)?.unit}
          />
        )}
        <TrackerChart data={chartData} chartType={chartType} color={color} />
      </div>
    </div>
  )
}
