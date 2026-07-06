'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { layoutFlow } from '@/lib/flowchart-layout'
import { safeHref } from '@/lib/editor/safe-href'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicFlowchartElement({ element }: { element: CanvasElement }) {
  const nodes = element.flowNodes ?? []
  const [openId, setOpenId] = useState<string | null>(null)

  if (nodes.length === 0) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-400 text-center">No steps yet.</div>
  }

  const { nodes: laid, edges, width, height } = layoutFlow(nodes)
  const openNode = laid.find((l) => l.id === openId)?.node
  const openUrl = openNode ? safeHref(openNode.linkUrl) : undefined
  const external = !!openUrl && /^https?:|^mailto:/i.test(openUrl)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {element.flowTitle && <h3 className="text-base font-bold text-slate-900 mb-3">{element.flowTitle}</h3>}

      <div className="overflow-auto">
        <div className="relative mx-auto" style={{ width, height }}>
          {/* Arrow overlay */}
          <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
            <defs>
              <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const midX = (e.x1 + e.x2) / 2
              const midY = (e.y1 + e.y2) / 2
              return (
                <g key={i}>
                  <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#flow-arrow)" />
                  {e.label && (
                    <text x={midX} y={midY} dy={-4} textAnchor="middle" className="fill-slate-500" fontSize={11}>{e.label}</text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Node cards */}
          {laid.map((l) => (
            <button
              key={l.id}
              onClick={() => setOpenId(l.id)}
              className="absolute rounded-xl border-2 bg-white px-3 py-2 text-left shadow-sm hover:shadow-md transition-shadow"
              style={{ left: l.x, top: l.y, width: l.w, height: l.h, borderColor: l.node.color ?? '#e2e8f0' }}
            >
              <div className="flex items-center gap-1.5">
                {l.node.icon && <span className="text-base leading-none">{l.node.icon}</span>}
                <span className="text-sm font-semibold text-slate-900 truncate">{l.node.title}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail popover */}
      {openNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpenId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {openNode.icon && <span>{openNode.icon}</span>}{openNode.title}
              </h4>
              <button onClick={() => setOpenId(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {openNode.description && <p className="mt-2 text-sm text-slate-600">{openNode.description}</p>}
            {openUrl && (
              <a
                href={openUrl}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
              >
                {openNode.linkLabel ? `Open ${openNode.linkLabel} →` : 'Open →'}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
