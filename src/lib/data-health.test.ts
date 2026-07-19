import { describe, it, expect } from 'vitest'
import {
  HEALTH_MIN_VIEWS,
  computeDelta,
  computeHealth,
  metricScore,
  type MetricPair,
} from './data-health'

const pair = (current: number, previous: number): MetricPair => ({ current, previous })

describe('metricScore', () => {
  it('scores a flat metric at half marks', () => {
    expect(metricScore(pair(100, 100))).toBe(10)
  })

  it('scores 50%+ growth at full marks', () => {
    expect(metricScore(pair(150, 100))).toBe(20)
    expect(metricScore(pair(1000, 100))).toBe(20)
  })

  it('scores a 50%+ decline at zero', () => {
    expect(metricScore(pair(50, 100))).toBe(0)
    expect(metricScore(pair(0, 100))).toBe(0)
  })

  it('interpolates linearly between the bounds', () => {
    expect(metricScore(pair(125, 100))).toBe(15)
    expect(metricScore(pair(75, 100))).toBe(5)
  })

  it('gives full marks to growth from a zero baseline', () => {
    expect(metricScore(pair(7, 0))).toBe(20)
  })

  it('treats zero-to-zero as flat, not as a decline', () => {
    expect(metricScore(pair(0, 0))).toBe(10)
  })
})

describe('computeDelta', () => {
  it('returns percentage change against a non-zero baseline', () => {
    expect(computeDelta(pair(118, 100))).toBeCloseTo(18)
    expect(computeDelta(pair(82, 100))).toBeCloseTo(-18)
  })

  it('returns null ("New") for growth from a zero baseline', () => {
    expect(computeDelta(pair(12, 0))).toBeNull()
  })

  it('returns 0 when both periods are empty', () => {
    expect(computeDelta(pair(0, 0))).toBe(0)
  })
})

describe('computeHealth', () => {
  const strong = {
    views: pair(1284, 1000),
    visitors: pair(812, 700),
    followers: pair(356, 300),
    shares: pair(74, 60),
    interactions: pair(1102, 800),
  }

  it('sums five equally weighted metrics into a 0-100 score', () => {
    const result = computeHealth(strong)
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(Number.isInteger(result.score)).toBe(true)
  })

  it('awards a perfect score when every metric grows 50%+', () => {
    const result = computeHealth({
      views: pair(200, 100), visitors: pair(200, 100), followers: pair(200, 100),
      shares: pair(200, 100), interactions: pair(200, 100),
    })
    expect(result.score).toBe(100)
    expect(result.band).toBe('excellent')
  })

  it('scores a totally flat page at 50 (fair)', () => {
    const result = computeHealth({
      views: pair(100, 100), visitors: pair(100, 100), followers: pair(100, 100),
      shares: pair(100, 100), interactions: pair(100, 100),
    })
    expect(result.score).toBe(50)
    expect(result.band).toBe('fair')
  })

  it('bands the score at the documented thresholds', () => {
    const bandFor = (score: number) => {
      // craft metrics that produce an exact score: each metric contributes 20
      // at +50% growth and 10 when flat, so mix full-growth and flat metrics.
      const full = Math.floor(score / 20)
      const metrics: Record<string, MetricPair> = {}
      const keys = ['views', 'visitors', 'followers', 'shares', 'interactions']
      keys.forEach((k, i) => { metrics[k] = i < full ? pair(200, 100) : pair(0, 100) })
      return computeHealth(metrics).band
    }
    expect(bandFor(100)).toBe('excellent')
    expect(bandFor(80)).toBe('good')
    expect(bandFor(60)).toBe('fair')
    expect(bandFor(20)).toBe('needs-attention')
  })

  it('flags insufficient data below the view floor and reports no score', () => {
    const result = computeHealth({
      ...strong,
      views: pair(HEALTH_MIN_VIEWS - 1, 0),
    })
    expect(result.insufficientData).toBe(true)
    expect(result.score).toBe(0)
  })

  it('does not flag insufficient data at exactly the floor', () => {
    const result = computeHealth({ ...strong, views: pair(HEALTH_MIN_VIEWS, 10) })
    expect(result.insufficientData).toBe(false)
  })

  it('lists drivers ordered by absolute movement, largest first', () => {
    const result = computeHealth({
      views: pair(101, 100), visitors: pair(700, 100), followers: pair(120, 100),
      shares: pair(60, 100), interactions: pair(100, 100),
    })
    expect(result.drivers[0].key).toBe('visitors')
    expect(result.drivers.map((d) => d.key)).not.toContain('interactions')
  })
})
