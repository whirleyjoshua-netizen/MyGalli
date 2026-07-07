'use client'

import { useRef, useState } from 'react'
import { Mic, Square, Upload, Send, Inbox } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicMailboxElement({ element }: { element: CanvasElement }) {
  const displayId = (element as { displayId?: string }).displayId || ''
  const allowAudio = element.mailboxAllowAudio ?? true
  const requireName = element.mailboxRequireName ?? false

  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [hp, setHp] = useState('')
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRec = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      rec.start(); recRef.current = rec; setRecording(true)
    } catch { setError('Microphone unavailable — you can upload a file instead.') }
  }
  const stopRec = () => { recRef.current?.stop(); setRecording(false) }
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setAudioBlob(f); setAudioUrl(URL.createObjectURL(f))
  }

  const submit = async () => {
    setError(null)
    if (!text.trim() && !audioBlob) { setError('Write or record a message first.'); return }
    if (requireName && !name.trim()) { setError('Please add your name.'); return }
    setSending(true)
    try {
      let mediaUrl = ''
      let kind: 'text' | 'audio' = 'text'
      if (audioBlob) {
        const fd = new FormData()
        fd.append('file', audioBlob, 'message.webm')
        const up = await fetch('/api/messages/upload', { method: 'POST', body: fd })
        if (up.ok) { const d = await up.json(); mediaUrl = d.url; kind = 'audio' }
        else { setError('Could not upload the audio.'); setSending(false); return }
      }
      const res = await fetch('/api/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayId, elementId: element.id, kind, body: text.trim() || undefined, mediaUrl: mediaUrl || undefined, senderName: name.trim() || undefined, senderEmail: email.trim() || undefined, hp }),
      })
      if (res.ok) setSent(true)
      else setError('Something went wrong — try again.')
    } catch { setError('Network error — try again.') }
    finally { setSending(false) }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <Inbox className="w-6 h-6 mx-auto text-primary mb-2" />
        <p className="text-sm font-medium text-slate-700">{element.mailboxThankYou || 'Thanks — your message was sent!'}</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      {element.mailboxTitle && <h3 className="text-base font-bold text-slate-900">{element.mailboxTitle}</h3>}
      {element.mailboxPrompt && <p className="mt-1 text-sm text-slate-500">{element.mailboxPrompt}</p>}

      <textarea
        value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Your message…" rows={3}
        className="mt-3 w-full text-sm border border-slate-200 rounded-lg px-3 py-2"
      />

      {allowAudio && (
        <div className="mt-2 flex items-center gap-2">
          {!recording ? (
            <button type="button" onClick={startRec} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
              <Mic className="w-3.5 h-3.5" /> Record
            </button>
          ) : (
            <button type="button" onClick={stopRec} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700">
              <Square className="w-3.5 h-3.5" /> Stop
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Upload
            <input type="file" accept="audio/*" className="hidden" onChange={onFile} />
          </label>
          {audioUrl && <audio src={audioUrl} controls className="h-8" />}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={requireName ? 'Your name *' : 'Your name (optional)'} className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" className="text-sm border border-slate-200 rounded-lg px-3 py-2" />
      </div>

      {/* Honeypot — hidden from humans, bots fill it */}
      <input type="text" name="hp" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} />

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button type="button" onClick={submit} disabled={sending} className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
        <Send className="w-3.5 h-3.5" /> {sending ? 'Sending…' : (element.mailboxButtonLabel || 'Send')}
      </button>
    </div>
  )
}
