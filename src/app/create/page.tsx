'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Copy,
  ExternalLink,
  Pencil,
  Loader2,
  ChevronLeft,
  Briefcase,
  Smile,
  Minus,
  Zap,
  Sun,
} from 'lucide-react'

const VIBES = [
  { id: 'professional', label: 'Professional', icon: Briefcase, description: 'Clean & structured' },
  { id: 'playful', label: 'Playful', icon: Smile, description: 'Colorful & fun' },
  { id: 'minimal', label: 'Minimal', icon: Minus, description: 'Simple & spacious' },
  { id: 'bold', label: 'Bold', icon: Zap, description: 'Dark & dramatic' },
  { id: 'warm', label: 'Warm', icon: Sun, description: 'Soft & inviting' },
] as const

const SUGGESTIONS = [
  'An onboarding doc for new team members at a startup',
  'A wedding website for Sarah & James, June 15th ceremony',
  'A personal portfolio for a frontend developer',
  'A restaurant page for an Italian bistro with menu and hours',
  'A coach\'s client welcome package with session structure',
  'A product launch announcement with features and pricing',
  'A study guide for AP Biology with key concepts and practice questions',
  'A real estate listing page for a modern downtown apartment',
]

interface GenerateResult {
  url: string
  editUrl: string
  displayId: string
  shareCode: string
  title: string
}

export default function CreatePage() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [vibe, setVibe] = useState('professional')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (!prompt.trim() || prompt.trim().length < 5) {
      setError('Tell us a bit more about what you want to create.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), vibe }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }

      setResult(data)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopyLink = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30">
      {/* Nav */}
      <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <Link href="/" className="font-bold text-lg text-galli-dark">
            My Galli
          </Link>
          <div className="w-20" />
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        {!result ? (
          <>
            {/* Header */}
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                AI Page Builder
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                What do you want to make?
              </h1>
              <p className="text-gray-500 text-lg">
                Describe it. We&apos;ll build it. You&apos;ll share it.
              </p>
            </div>

            {/* Prompt Input */}
            <div className="mb-6">
              <textarea
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value)
                  if (error) setError('')
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
                    handleGenerate()
                  }
                }}
                placeholder="e.g., An onboarding doc for my two new co-founders with our mission, tools we use, first week schedule, and team culture..."
                className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 resize-none text-base leading-relaxed"
                disabled={loading}
                autoFocus
              />
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>Be specific — the more detail, the better the page</span>
                <span>{prompt.length}/1000</span>
              </div>
            </div>

            {/* Suggestions */}
            <div className="mb-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Try these</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.slice(0, 4).map((s) => (
                  <button
                    key={s}
                    onClick={() => setPrompt(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                    disabled={loading}
                  >
                    {s.length > 50 ? s.slice(0, 50) + '...' : s}
                  </button>
                ))}
              </div>
            </div>

            {/* Vibe Selector */}
            <div className="mb-8">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Choose a vibe</p>
              <div className="grid grid-cols-5 gap-2">
                {VIBES.map((v) => {
                  const Icon = v.icon
                  const active = vibe === v.id
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVibe(v.id)}
                      disabled={loading}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                        active
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-xs font-medium">{v.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full bg-galli text-white font-semibold text-base hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-200/50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating your page...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Page
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {loading && (
              <p className="text-center text-sm text-gray-400 mt-3">
                This usually takes 5-10 seconds
              </p>
            )}
          </>
        ) : (
          /* Success State */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-6">
              <Sparkles className="w-8 h-8 text-emerald-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {result.title}
            </h1>
            <p className="text-gray-500 mb-8">
              Your page is live and ready to share
            </p>

            {/* Link Display */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200 mb-6">
              <code className="flex-1 text-sm text-gray-700 truncate text-left">
                {result.url}
              </code>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <a
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-full bg-galli text-white font-semibold hover:brightness-110 transition-all shadow-lg shadow-emerald-200/50"
              >
                <ExternalLink className="w-4 h-4" />
                Open Page
              </a>
              <button
                onClick={() => router.push(result.editUrl)}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-6 rounded-full border-2 border-gray-200 text-gray-700 font-semibold hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" />
                Edit in Editor
              </button>
            </div>

            {/* Create Another */}
            <button
              onClick={() => {
                setResult(null)
                setPrompt('')
                setError('')
              }}
              className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Create another page
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
