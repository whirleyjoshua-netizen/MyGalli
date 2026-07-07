'use client'

import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import { Loader2, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react'

// Self-hosted worker (committed at public/pdf.worker.min.mjs) — no CDN, CSP-safe.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export default function PdfView({ url, initialPage = 1 }: { url: string; initialPage?: number }) {
  const [numPages, setNumPages] = useState(0)
  const [page, setPage] = useState(initialPage)
  const [scale, setScale] = useState(1.2)
  const [error, setError] = useState(false)

  const btn = 'p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white'

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2 text-sm text-white">
        <button type="button" className={btn} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="tabular-nums">{page} / {numPages || '…'}</span>
        <button type="button" className={btn} onClick={() => setPage((p) => Math.min(numPages || p, p + 1))} disabled={!!numPages && page >= numPages} aria-label="Next page">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="mx-1 w-px h-4 bg-white/20" />
        <button type="button" className={btn} onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))} aria-label="Zoom out">
          <Minus className="w-4 h-4" />
        </button>
        <button type="button" className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs" onClick={() => setScale(1.2)}>Reset</button>
        <button type="button" className={btn} onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))} aria-label="Zoom in">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {error ? (
        <p className="text-sm text-white/80 mt-6">Couldn&apos;t render this PDF — use Download instead.</p>
      ) : (
        <div className="overflow-auto max-h-[80vh] rounded-lg bg-white">
          <Document
            file={url}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={() => setError(true)}
            loading={<div className="p-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}
          >
            <Page pageNumber={page} scale={scale} renderTextLayer renderAnnotationLayer={false} />
          </Document>
        </div>
      )}
    </div>
  )
}
