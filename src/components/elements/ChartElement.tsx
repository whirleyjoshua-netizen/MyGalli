'use client'

import { useState, useEffect } from 'react'
import { X, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { CanvasElement } from '@/lib/types/canvas'

interface ChartElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

type ChartType = 'bar' | 'line' | 'pie'

interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

const DEFAULT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

export function ChartElement({ element, onChange, onDelete, isSelected, onSelect }: ChartElementProps) {
  const [isAnimating, setIsAnimating] = useState(true)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoveredSeries, setHoveredSeries] = useState<number | null>(null)
  const [showChartData, setShowChartData] = useState(false)

  const chartType = element.chartType || 'bar'
  const chartTitle = element.chartTitle || 'Chart Title'
  const chartData = element.chartData || []
  const multiLineData = element.chartMultiLineData || { labels: [], series: [], yAxisLabels: [] }
  const enable3D = element.chartEnable3D ?? true
  const enableGlow = element.chartEnableGlow ?? true
  const enableGradient = element.chartEnableGradient ?? true
  const showValues = element.chartShowValues ?? true
  const showLegend = element.chartShowLegend ?? true
  const showGrid = element.chartShowGrid ?? true
  const nodeSize = element.chartNodeSize ?? 8

  useEffect(() => {
    setIsAnimating(true)
    const timer = setTimeout(() => setIsAnimating(false), 1000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const adjustBrightness = (color: string, amount: number) => {
    const num = parseInt(color.replace('#', ''), 16)
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount))
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount))
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount))
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
  }

  const getGlowStyle = (color: string, isHovered: boolean = false) => {
    if (!enableGlow && !enable3D) return {}
    const baseGlow = `0 0 15px ${color}40`
    const hoverGlow = `0 0 25px ${color}60`
    const shadow3D = enable3D ? `, 0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.1)` : ''
    return {
      boxShadow: `${isHovered ? hoverGlow : baseGlow}${shadow3D}`,
      filter: enable3D ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' : undefined,
    }
  }

  const getGradient = (color: string) => {
    if (!enableGradient) return color
    return `linear-gradient(135deg, ${color}, ${adjustBrightness(color, -20)})`
  }

  // Pie Chart Renderer
  const renderPieChart = () => {
    const total = chartData.reduce((sum, point) => sum + point.value, 0)
    let currentAngle = -90

    return (
      <div className="flex items-center justify-center gap-8">
        <div
          className="relative transition-transform duration-500"
          style={{
            width: '200px',
            height: '200px',
            transform: enable3D ? 'perspective(1000px) rotateX(10deg)' : undefined,
          }}
        >
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <defs>
              {chartData.map((point, index) => {
                const color = point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
                return (
                  <linearGradient key={`grad-${index}`} id={`pieGrad-${element.id}-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="1" />
                    <stop offset="100%" stopColor={adjustBrightness(color, -30)} stopOpacity="1" />
                  </linearGradient>
                )
              })}
              {enableGlow && (
                <filter id={`glow-${element.id}`}>
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              )}
            </defs>

            {chartData.map((point, index) => {
              const percentage = point.value / total
              const angle = percentage * 360
              const startAngle = currentAngle
              const endAngle = currentAngle + angle
              currentAngle = endAngle

              const startRad = (startAngle * Math.PI) / 180
              const endRad = (endAngle * Math.PI) / 180
              const radius = hoveredIndex === index ? 48 : 45
              const x1 = 50 + radius * Math.cos(startRad)
              const y1 = 50 + radius * Math.sin(startRad)
              const x2 = 50 + radius * Math.cos(endRad)
              const y2 = 50 + radius * Math.sin(endRad)
              const largeArc = angle > 180 ? 1 : 0
              const color = point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]

              const midAngle = startAngle + angle / 2
              const midRad = (midAngle * Math.PI) / 180
              const labelX = 50 + 35 * Math.cos(midRad)
              const labelY = 50 + 35 * Math.sin(midRad)
              const offsetX = hoveredIndex === index ? 3 * Math.cos(midRad) : 0
              const offsetY = hoveredIndex === index ? 3 * Math.sin(midRad) : 0

              return (
                <g
                  key={index}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px)`,
                    transformOrigin: '50px 50px',
                    transition: 'all 0.3s ease',
                  }}
                >
                  {enable3D && (
                    <path
                      d={`M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill="rgba(0,0,0,0.15)"
                      transform="translate(0, 2)"
                    />
                  )}
                  <path
                    d={`M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
                    fill={enableGradient ? `url(#pieGrad-${element.id}-${index})` : color}
                    stroke="white"
                    strokeWidth="2.5"
                    filter={enableGlow ? `url(#glow-${element.id})` : undefined}
                    className="cursor-pointer"
                    style={{
                      opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.7,
                      transition: 'all 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
                      transformOrigin: '50px 50px',
                      transform: isAnimating ? 'scale(0)' : 'scale(1)',
                      transitionDelay: `${index * 100}ms`,
                    }}
                  />
                  {showValues && percentage > 0.05 && (
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="font-bold pointer-events-none"
                      style={{
                        fontSize: '10px',
                        fill: 'white',
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                      }}
                    >
                      {(percentage * 100).toFixed(0)}%
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {showLegend && (
          <div className="flex flex-col gap-2">
            {chartData.map((point, index) => {
              const color = point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
              const percentage = (point.value / total) * 100
              const isHovered = hoveredIndex === index
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 text-sm cursor-pointer transition-all duration-300"
                  style={{
                    transform: isHovered ? 'translateX(4px)' : 'translateX(0)',
                    opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                  }}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <div
                    className="w-3 h-3 rounded flex-shrink-0 transition-all duration-300"
                    style={{
                      background: enableGradient ? getGradient(color) : color,
                      transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                      ...getGlowStyle(color, isHovered),
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-slate-700 dark:text-slate-300 text-xs">
                      {point.label}
                    </div>
                    {showValues && (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {point.value} ({percentage.toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Bar Chart Renderer
  const renderBarChart = () => {
    const maxValue = Math.max(...chartData.map(p => p.value), 1)

    return (
      <div className="flex-1 flex flex-col h-full">
        <div className="flex-1 flex items-stretch justify-around relative" style={{ gap: '12px', height: '200px', paddingRight: enable3D ? '8px' : undefined, paddingTop: enable3D ? '8px' : undefined }}>
          {showGrid && (
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              {[0, 1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-full transition-all duration-500"
                  style={{
                    borderTop: '1.5px dashed rgba(148, 163, 184, 0.3)',
                    opacity: isAnimating ? 0 : 1,
                    transitionDelay: `${i * 50}ms`,
                  }}
                />
              ))}
            </div>
          )}

          {chartData.map((point, index) => {
            const heightPercentage = (point.value / maxValue) * 100
            const color = point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
            const isHovered = hoveredIndex === index

            return (
              <div
                key={index}
                className="flex flex-col items-center flex-1 z-10"
                style={{ height: '100%' }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {showValues && (
                  <div
                    className="mb-2 font-bold transition-all duration-300 flex-shrink-0"
                    style={{
                      fontSize: '12px',
                      color: color,
                      opacity: isAnimating ? 0 : 1,
                      transform: isAnimating ? 'translateY(-10px)' : 'translateY(0)',
                      transitionDelay: `${index * 100 + 300}ms`,
                      filter: enableGlow ? `drop-shadow(0 0 8px ${color}60)` : undefined,
                    }}
                  >
                    {point.value}
                  </div>
                )}

                <div className="flex-1 w-full relative" style={{ minHeight: 0 }}>
                  <div
                    className={`absolute bottom-0 left-0 right-0 cursor-pointer ${enable3D ? 'rounded-t-sm' : 'rounded-t'}`}
                    style={{
                      height: isAnimating ? '0%' : `${heightPercentage}%`,
                      background: enableGradient
                        ? `linear-gradient(180deg, ${color}, ${adjustBrightness(color, -30)})`
                        : color,
                      minHeight: point.value > 0 && !isAnimating ? '4px' : '0px',
                      transform: isHovered ? 'scaleX(1.05)' : 'scaleX(1)',
                      transformOrigin: 'bottom',
                      transition: isAnimating
                        ? `all 1000ms cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 150}ms`
                        : 'all 300ms ease',
                      ...getGlowStyle(color, isHovered),
                    }}
                  >
                    {enable3D && !isAnimating && (
                      <>
                        <div
                          className="absolute left-0 w-full"
                          style={{
                            bottom: '100%',
                            height: '6px',
                            background: adjustBrightness(color, 30),
                            transform: 'skewX(-45deg)',
                            transformOrigin: 'bottom left',
                          }}
                        />
                        <div
                          className="absolute top-0 h-full"
                          style={{
                            left: '100%',
                            width: '6px',
                            background: adjustBrightness(color, -40),
                            transform: 'skewY(-45deg)',
                            transformOrigin: 'top left',
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div
                  className="mt-3 font-semibold text-center transition-all duration-500 flex-shrink-0"
                  style={{
                    fontSize: '12px',
                    color: isHovered ? color : '#1f2937',
                    opacity: isAnimating ? 0 : 1,
                    transform: `scale(${isHovered ? 1.1 : 1})`,
                    transitionDelay: isAnimating ? `${index * 100 + 500}ms` : '0ms',
                  }}
                >
                  {point.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Line Chart Renderer
  const renderLineChart = () => {
    const { labels, series, yAxisLabels = [] } = multiLineData
    const chartLabels = labels.length > 0 ? labels : ['Q1', 'Q2', 'Q3', 'Q4']
    const chartSeries = series.length > 0 ? series : [
      { name: 'Series A', color: '#3b82f6', values: [20, 45, 35, 80] },
      { name: 'Series B', color: '#ef4444', values: [30, 25, 55, 65] },
    ]
    const customYAxisLabels = yAxisLabels.length > 0 ? yAxisLabels : ['0', '25', '50', '75', '100']

    const allValues = chartSeries.flatMap(s => s.values)
    const maxVal = Math.max(...allValues, 1)
    const minVal = Math.min(...allValues, 0)
    const valueRange = maxVal - minVal || 1

    const chartLeft = 12
    const chartWidth = 100 - chartLeft

    const generateSeriesPath = (values: number[]) => {
      if (values.length === 0) return ''
      const points = values.map((value, index) => {
        const x = chartLeft + (index / Math.max(values.length - 1, 1)) * chartWidth
        const y = 95 - ((value - minVal) / valueRange) * 85
        return { x, y }
      })

      let path = `M ${points[0].x} ${points[0].y}`
      for (let i = 0; i < points.length - 1; i++) {
        const xMid = (points[i].x + points[i + 1].x) / 2
        const yMid = (points[i].y + points[i + 1].y) / 2
        path += ` Q ${points[i].x} ${points[i].y}, ${xMid} ${yMid}`
        if (i === points.length - 2) {
          path += ` Q ${points[i + 1].x} ${points[i + 1].y}, ${points[i + 1].x} ${points[i + 1].y}`
        }
      }
      return path
    }

    const getSeriesPoints = (values: number[]) => {
      return values.map((value, index) => {
        const x = chartLeft + (index / Math.max(values.length - 1, 1)) * chartWidth
        const y = 95 - ((value - minVal) / valueRange) * 85
        return { x, y, value }
      })
    }

    return (
      <div className="flex-1 flex flex-col h-full">
        {showLegend && (
          <div className="flex flex-wrap gap-4 mb-4 justify-center">
            {chartSeries.map((s, idx) => {
              const isHovered = hoveredSeries === idx
              return (
                <div
                  key={idx}
                  className="flex items-center gap-2 cursor-pointer transition-all duration-300"
                  style={{
                    opacity: hoveredSeries === null || isHovered ? 1 : 0.4,
                    transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                  }}
                  onMouseEnter={() => setHoveredSeries(idx)}
                  onMouseLeave={() => setHoveredSeries(null)}
                >
                  <div
                    className="w-4 h-1 rounded-full"
                    style={{
                      backgroundColor: s.color,
                      boxShadow: enableGlow ? `0 0 8px ${s.color}` : undefined,
                    }}
                  />
                  <span className="text-sm font-semibold" style={{ color: s.color }}>
                    {s.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <div className="flex-1 relative" style={{ minHeight: '150px' }}>
          <svg
            className="w-full h-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ filter: enable3D ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' : undefined }}
          >
            <defs>
              {chartSeries.map((s, idx) => (
                <linearGradient key={`grad-${idx}`} id={`lineGrad-${element.id}-${idx}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0.05" />
                </linearGradient>
              ))}
              {enableGlow && (
                <filter id={`lineGlow-${element.id}`}>
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              )}
            </defs>

            {showGrid && (
              <>
                <rect x={chartLeft} y="5" width={chartWidth} height="90" fill="rgba(148, 163, 184, 0.03)" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" style={{ opacity: isAnimating ? 0 : 1, transition: 'opacity 0.5s ease' }} />
                {customYAxisLabels.map((tick, idx) => {
                  const tickCount = customYAxisLabels.length - 1
                  const y = 95 - (idx / Math.max(tickCount, 1)) * 85
                  return (
                    <g key={`y-${idx}`}>
                      <text x={chartLeft - 1} y={y} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '6px', fill: '#1f2937', opacity: isAnimating ? 0 : 0.7, transition: 'opacity 0.5s ease' }}>{tick}</text>
                      <line x1={chartLeft} y1={y} x2="100" y2={y} stroke="rgba(148, 163, 184, 0.25)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" style={{ opacity: isAnimating ? 0 : 1, transition: 'opacity 0.5s ease' }} />
                    </g>
                  )
                })}
                {chartLabels.map((_, idx) => {
                  const x = chartLeft + (idx / Math.max(chartLabels.length - 1, 1)) * chartWidth
                  return <line key={`v-${idx}`} x1={x} y1="5" x2={x} y2="95" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" style={{ opacity: isAnimating ? 0 : 1, transition: 'opacity 0.5s ease' }} />
                })}
              </>
            )}

            {chartSeries.map((s, seriesIdx) => {
              const path = generateSeriesPath(s.values)
              const isSeriesHovered = hoveredSeries === seriesIdx
              if (!path) return null
              const lastX = chartLeft + chartWidth
              return (
                <path
                  key={`fill-${seriesIdx}`}
                  d={`${path} L ${lastX} 95 L ${chartLeft} 95 Z`}
                  fill={`url(#lineGrad-${element.id}-${seriesIdx})`}
                  style={{ opacity: isAnimating ? 0 : (hoveredSeries === null || isSeriesHovered ? 1 : 0.2), transition: `opacity 1000ms ease ${seriesIdx * 100 + 300}ms` }}
                />
              )
            })}

            {chartSeries.map((s, seriesIdx) => {
              const path = generateSeriesPath(s.values)
              const isSeriesHovered = hoveredSeries === seriesIdx
              if (!path) return null
              return (
                <path
                  key={`line-${seriesIdx}`}
                  d={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={isSeriesHovered ? 4 : 3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  filter={enableGlow ? `url(#lineGlow-${element.id})` : undefined}
                  className="cursor-pointer transition-all duration-300"
                  style={{
                    opacity: hoveredSeries === null || isSeriesHovered ? 1 : 0.3,
                    strokeDasharray: isAnimating ? '1000' : undefined,
                    strokeDashoffset: isAnimating ? '1000' : undefined,
                    animation: isAnimating ? `drawLine 1000ms ease ${seriesIdx * 200}ms forwards` : undefined,
                  }}
                  onMouseEnter={() => setHoveredSeries(seriesIdx)}
                  onMouseLeave={() => setHoveredSeries(null)}
                />
              )
            })}

          </svg>

          {/* HTML circle overlays — rendered outside SVG to avoid preserveAspectRatio distortion */}
          {!isAnimating && nodeSize > 0 && chartSeries.map((s, seriesIdx) => {
            const points = getSeriesPoints(s.values)
            const isSeriesHovered = hoveredSeries === seriesIdx
            return points.map((point, pointIdx) => {
              const isPointHovered = hoveredSeries === seriesIdx && hoveredIndex === pointIdx
              const dotSize = isPointHovered ? nodeSize * 1.5 : nodeSize
              return (
                <div
                  key={`dot-${seriesIdx}-${pointIdx}`}
                  className="absolute z-10"
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    transform: 'translate(-50%, -50%)',
                    opacity: hoveredSeries === null || isSeriesHovered ? 1 : 0.3,
                    transition: 'all 300ms ease',
                  }}
                  onMouseEnter={() => { setHoveredSeries(seriesIdx); setHoveredIndex(pointIdx) }}
                  onMouseLeave={() => { setHoveredSeries(null); setHoveredIndex(null) }}
                >
                  {isPointHovered && (
                    <div
                      className="absolute rounded-full"
                      style={{
                        width: `${nodeSize * 2.5}px`,
                        height: `${nodeSize * 2.5}px`,
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        backgroundColor: `${s.color}20`,
                      }}
                    />
                  )}
                  <div
                    className="rounded-full cursor-pointer transition-all duration-300"
                    style={{
                      width: `${dotSize}px`,
                      height: `${dotSize}px`,
                      backgroundColor: s.color,
                      border: '2px solid white',
                      boxShadow: enable3D ? '0 2px 4px rgba(0,0,0,0.3)' : undefined,
                    }}
                  />
                  {showValues && isPointHovered && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 px-2 py-1 rounded text-white text-xs font-bold whitespace-nowrap pointer-events-none"
                      style={{
                        bottom: `${dotSize / 2 + 8}px`,
                        backgroundColor: s.color,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    >
                      {point.value}
                    </div>
                  )}
                </div>
              )
            })
          })}
        </div>

        <div className="flex justify-between mt-3 px-1">
          {chartLabels.map((label, index) => (
            <div
              key={index}
              className="text-center font-semibold transition-all duration-300"
              style={{ fontSize: '12px', color: '#1f2937', opacity: isAnimating ? 0 : 1, transitionDelay: isAnimating ? `${index * 100 + 1000}ms` : '0ms' }}
            >
              {label}
            </div>
          ))}
        </div>

        <style jsx>{`
          @keyframes drawLine {
            to { stroke-dashoffset: 0; }
          }
        `}</style>
      </div>
    )
  }

  const updateDataPoint = (index: number, field: keyof ChartDataPoint, value: string | number) => {
    const newData = [...chartData]
    if (field === 'value') {
      newData[index] = { ...newData[index], value: typeof value === 'string' ? parseFloat(value) || 0 : value }
    } else if (field === 'label') {
      newData[index] = { ...newData[index], label: value as string }
    } else if (field === 'color') {
      newData[index] = { ...newData[index], color: value as string }
    }
    onChange({ chartData: newData })
  }

  const addDataPoint = () => {
    const newPoint: ChartDataPoint = {
      label: `Item ${chartData.length + 1}`,
      value: Math.floor(Math.random() * 50) + 20,
      color: DEFAULT_COLORS[chartData.length % DEFAULT_COLORS.length],
    }
    onChange({ chartData: [...chartData, newPoint] })
  }

  const removeDataPoint = (index: number) => {
    if (chartData.length <= 1) return
    onChange({ chartData: chartData.filter((_, i) => i !== index) })
  }

  return (
    <div
      className={`relative group p-6 rounded-lg border-2 transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
      onClick={onSelect}
    >
      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg z-10"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      <input
        type="text"
        value={chartTitle}
        onChange={(e) => onChange({ chartTitle: e.target.value })}
        className="w-full text-xl font-bold mb-4 bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:outline-none pb-2 text-slate-900 dark:text-white"
        placeholder="Enter chart title"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="mb-4" style={{ minHeight: '250px', backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px' }}>
        {chartType === 'pie' && renderPieChart()}
        {chartType === 'bar' && renderBarChart()}
        {chartType === 'line' && renderLineChart()}
      </div>

      {isSelected && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Data
          </div>

          {/* Chart Data */}
          {chartType !== 'line' && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                onClick={(e) => { e.stopPropagation(); setShowChartData(!showChartData) }}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {showChartData ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Chart Data</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">{chartData.length} items</span>
              </button>
              {showChartData && (
                <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  {chartData.map((point, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={point.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]}
                        onChange={(e) => updateDataPoint(index, 'color', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="text"
                        value={point.label}
                        onChange={(e) => updateDataPoint(index, 'label', e.target.value)}
                        className="flex-1 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        placeholder="Label"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <input
                        type="number"
                        value={point.value}
                        onChange={(e) => updateDataPoint(index, 'value', e.target.value)}
                        className="w-20 px-2 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white"
                        placeholder="Value"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); removeDataPoint(index) }}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-30"
                        disabled={chartData.length <= 1}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); addDataPoint() }}
                    className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Data Point
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
