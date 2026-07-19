// Page Health is a pure growth score: how is this page moving compared with the
// immediately preceding window of equal length? Five metrics each contribute an
// equally weighted 20 points.

export interface MetricPair {
  current: number
  previous: number
}

export type HealthBand = 'excellent' | 'good' | 'fair' | 'needs-attention'

export interface HealthDriver {
  key: string
  label: string
  delta: number
}

export interface HealthResult {
  score: number
  band: HealthBand
  drivers: HealthDriver[]
  insufficientData: boolean
}

// Below this many views in the period, growth percentages are statistical noise
// and a score would be actively misleading, so we show a prompt instead.
export const HEALTH_MIN_VIEWS = 20

export const HEALTH_METRIC_KEYS = ['views', 'visitors', 'followers', 'shares', 'interactions'] as const

const METRIC_LABELS: Record<string, string> = {
  views: 'Views',
  visitors: 'Visitors',
  followers: 'Followers',
  shares: 'Shares',
  interactions: 'Interactions',
}

const POINTS_PER_METRIC = 20
const GROWTH_CAP = 0.5 // ±50% growth saturates the metric's score

// 0..20. Flat = 10. +50% or better = 20. -50% or worse = 0. Linear between.
export function metricScore({ current, previous }: MetricPair): number {
  if (previous === 0) return current > 0 ? POINTS_PER_METRIC : POINTS_PER_METRIC / 2
  const growth = (current - previous) / previous
  const clamped = Math.max(-GROWTH_CAP, Math.min(GROWTH_CAP, growth))
  return (POINTS_PER_METRIC / 2) * (1 + clamped / GROWTH_CAP)
}

// Percentage change, or null meaning "New" (grew from a zero baseline).
export function computeDelta({ current, previous }: MetricPair): number | null {
  if (previous === 0) return current > 0 ? null : 0
  return ((current - previous) / previous) * 100
}

function bandFor(score: number): HealthBand {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'fair'
  return 'needs-attention'
}

export function computeHealth(metrics: Record<string, MetricPair>): HealthResult {
  const views = metrics.views ?? { current: 0, previous: 0 }
  if (views.current < HEALTH_MIN_VIEWS) {
    return { score: 0, band: 'needs-attention', drivers: [], insufficientData: true }
  }

  const total = HEALTH_METRIC_KEYS.reduce(
    (sum, key) => sum + metricScore(metrics[key] ?? { current: 0, previous: 0 }),
    0
  )
  const score = Math.round(total)

  const drivers = HEALTH_METRIC_KEYS
    .map((key) => {
      const pair = metrics[key] ?? { current: 0, previous: 0 }
      return { key, label: METRIC_LABELS[key], delta: pair.current - pair.previous }
    })
    .filter((d) => d.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3)

  return { score, band: bandFor(score), drivers, insufficientData: false }
}
