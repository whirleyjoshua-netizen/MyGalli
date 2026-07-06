'use client'

import { useRef, useState } from 'react'
import { Trash2, X, Music, Upload, Loader2, Image as ImageIcon } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

type SourceType = 'file' | 'spotify' | 'soundcloud'

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Upload failed')
  }
  const data = await response.json()
  return data.url
}

export function AudioPlayerElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const sourceType: SourceType = element.audioSourceType || 'file'
  const audioInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingAudio, setIsUploadingAudio] = useState(false)
  const [isUploadingCover, setIsUploadingCover] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleAudioFile = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      setUploadError('Please choose an audio file')
      return
    }
    setIsUploadingAudio(true)
    setUploadError(null)
    try {
      const url = await uploadFile(file)
      onChange({ audioUrl: url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingAudio(false)
    }
  }

  const handleCoverFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUploadError('Please choose an image file')
      return
    }
    setIsUploadingCover(true)
    setUploadError(null)
    try {
      const url = await uploadFile(file)
      onChange({ audioCoverUrl: url })
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploadingCover(false)
    }
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${
        isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Music Player</span>
        </div>

        {/* Source selector */}
        <div className="flex gap-1.5">
          {(['file', 'spotify', 'soundcloud'] as SourceType[]).map((t) => (
            <button
              key={t}
              onClick={(e) => { e.stopPropagation(); onChange({ audioSourceType: t }) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                sourceType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {t === 'file' ? 'Upload / URL' : t}
            </button>
          ))}
        </div>

        {sourceType === 'file' ? (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); audioInputRef.current?.click() }}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-xs"
              >
                {isUploadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Upload audio
              </button>
              <span className="text-xs text-muted-foreground">or paste a URL below</span>
            </div>
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f) }}
              onClick={(e) => e.stopPropagation()}
            />
            <input
              type="url"
              value={element.audioUrl ?? ''}
              onChange={(e) => onChange({ audioUrl: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="https://example.com/song.mp3"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={element.audioTitle ?? ''}
                onChange={(e) => onChange({ audioTitle: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Title"
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <input
                type="text"
                value={element.audioArtist ?? ''}
                onChange={(e) => onChange({ audioArtist: e.target.value })}
                onClick={(e) => e.stopPropagation()}
                placeholder="Artist"
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); coverInputRef.current?.click() }}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-xs"
              >
                {isUploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                Upload cover
              </button>
              {element.audioCoverUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={element.audioCoverUrl} alt="" className="w-8 h-8 rounded-md object-cover" />
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCoverFile(f) }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex items-center gap-4 pt-1">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!element.audioAutoStart}
                  onChange={(e) => onChange({ audioAutoStart: e.target.checked })}
                />
                Auto-start
              </label>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={!!element.audioLoop}
                  onChange={(e) => onChange({ audioLoop: e.target.checked })}
                />
                Loop
              </label>
            </div>
          </>
        ) : (
          <>
            <input
              type="url"
              value={element.audioUrl ?? ''}
              onChange={(e) => onChange({ audioUrl: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder={sourceType === 'spotify' ? 'https://open.spotify.com/track/...' : 'https://soundcloud.com/artist/track'}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">Embeds play on press — Auto-start/Loop don&apos;t apply.</p>
          </>
        )}

        {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
