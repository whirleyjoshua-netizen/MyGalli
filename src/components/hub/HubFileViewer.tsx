'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { X, Download, Loader2 } from 'lucide-react'
import { fileKind } from '@/lib/hub-file-kind'
import { safeHref } from '@/lib/editor/safe-href'

// PDF renderer is client-only (pdf.js touches browser globals) — never SSR it.
const PdfView = dynamic(() => import('./PdfView'), {
  ssr: false,
  loading: () => <div className="p-10"><Loader2 className="w-6 h-6 animate-spin text-white" /></div>,
})

export interface HubFileViewerFile {
  id: string
  type: string
  title: string
  url: string | null
}

interface HubFileViewerProps {
  file: HubFileViewerFile | null
  onClose: () => void
  initialPage?: number
}

export function HubFileViewer({ file, onClose, initialPage }: HubFileViewerProps) {
  useEffect(() => {
    if (!file) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [file, onClose])

  if (!file) return null
  const href = safeHref(file.url ?? undefined)
  const kind = fileKind(file)

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      <div
        className="flex items-center justify-between px-4 py-3 text-white shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-medium truncate pr-4">{file.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          {href && (
            <a href={href} download target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-white/20" title="Download" aria-label="Download">
              <Download className="w-5 h-5" />
            </a>
          )}
          <button type="button" onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        data-testid="viewer-backdrop"
        className="flex-1 overflow-auto flex items-start justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {!href ? (
          <p className="text-white/80 text-sm mt-8">This file has no URL.</p>
        ) : kind === 'pdf' ? (
          <PdfView url={href} initialPage={initialPage} />
        ) : kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={href} alt={file.title} className="max-w-full max-h-full rounded-lg object-contain" />
        ) : (
          <div className="text-center text-white/80 mt-8">
            <p className="text-sm mb-3">This file can&apos;t be previewed.</p>
            <a href={href} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-white underline">
              <Download className="w-4 h-4" /> Download
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
