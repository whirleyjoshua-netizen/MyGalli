'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FileText, Trash2, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatResponseAnswer } from '@/lib/format-response'

interface FormResponseData {
  id: string
  sessionId: string | null
  responses: Record<string, { type: string; question: string; answer: unknown }>
  submittedAt: string
}

interface ResponsesData {
  display: { id: string; title: string }
  pagination: { page: number; limit: number; totalCount: number; totalPages: number }
  responses: FormResponseData[]
}

interface DisplayOption {
  id: string
  title: string
  slug: string
}

export default function ResponsesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading responses...</p>
      </div>
    }>
      <ResponsesContent />
    </Suspense>
  )
}

function ResponsesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [displays, setDisplays] = useState<DisplayOption[]>([])
  const [selectedDisplayId, setSelectedDisplayId] = useState<string | null>(
    searchParams.get('displayId')
  )
  const [data, setData] = useState<ResponsesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Fetch user's displays
  useEffect(() => {
    async function fetchDisplays() {
      try {
        const res = await fetch('/api/displays')
        if (res.ok) {
          const data = await res.json()
          setDisplays(data)
          if (!selectedDisplayId && data.length > 0) {
            setSelectedDisplayId(data[0].id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch displays:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDisplays()
  }, [router, selectedDisplayId])

  // Fetch responses
  useEffect(() => {
    if (!selectedDisplayId) return

    async function fetchResponses() {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/forms/${selectedDisplayId}?page=${page}&limit=20`
        )
        if (res.ok) {
          const data = await res.json()
          setData(data)
        }
      } catch (error) {
        console.error('Failed to fetch responses:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchResponses()
  }, [selectedDisplayId, page])

  const deleteResponse = async (responseId: string) => {
    if (!selectedDisplayId) return
    if (!confirm('Are you sure you want to delete this response?')) return

    try {
      const res = await fetch(
        `/api/forms/${selectedDisplayId}?responseId=${responseId}`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        // Refresh data
        setData((prev) =>
          prev
            ? {
                ...prev,
                responses: prev.responses.filter((r) => r.id !== responseId),
                pagination: {
                  ...prev.pagination,
                  totalCount: prev.pagination.totalCount - 1,
                },
              }
            : null
        )
      }
    } catch (error) {
      console.error('Failed to delete response:', error)
    }
  }

  const exportToCSV = () => {
    if (!data || data.responses.length === 0) return

    // Get all unique questions
    const questions = new Set<string>()
    data.responses.forEach((r) => {
      Object.values(r.responses).forEach((resp) => {
        questions.add(resp.question)
      })
    })

    // Build CSV
    const headers = ['Submitted At', 'Session ID', ...Array.from(questions)]
    const rows = data.responses.map((r) => {
      const row: string[] = [
        new Date(r.submittedAt).toLocaleString(),
        r.sessionId || 'N/A',
      ]
      questions.forEach((q) => {
        const response = Object.values(r.responses).find((resp) => resp.question === q)
        if (response) {
          row.push(formatResponseAnswer(response.answer))
        } else {
          row.push('')
        }
      })
      return row
    })

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `responses-${data.display.title}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold">Form Responses</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedDisplayId || ''}
              onChange={(e) => {
                setSelectedDisplayId(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 border border-border rounded-lg bg-background text-sm"
            >
              <option value="" disabled>Select a page</option>
              {displays.map((d) => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>

            {data && data.responses.length > 0 && (
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 text-sm"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <p className="text-muted-foreground">Loading responses...</p>
          </div>
        ) : !selectedDisplayId ? (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium mb-2">No page selected</h2>
            <p className="text-muted-foreground">
              Select a page from the dropdown to view its form responses.
            </p>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{data.display.title}</h2>
              <p className="text-sm text-muted-foreground">
                {data.pagination.totalCount} response{data.pagination.totalCount !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Responses List */}
            {data.responses.length === 0 ? (
              <div className="text-center py-16 bg-muted/30 rounded-lg border border-border">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No responses yet</h3>
                <p className="text-muted-foreground">
                  Form responses will appear here once visitors submit them.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.responses.map((response) => (
                  <div
                    key={response.id}
                    className="bg-muted/30 rounded-lg border border-border p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-sm text-muted-foreground">
                        {new Date(response.submittedAt).toLocaleString()}
                        {response.sessionId && (
                          <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded">
                            Session: {response.sessionId.substring(0, 12)}...
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteResponse(response.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {Object.entries(response.responses).map(([elementId, resp]) => (
                        <div key={elementId}>
                          <div className="text-sm font-medium mb-1">{resp.question}</div>
                          <div className="text-sm text-muted-foreground bg-background rounded px-3 py-2">
                            {formatResponseAnswer(resp.answer)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg disabled:opacity-50 text-sm"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {data.pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                  disabled={page === data.pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-2 bg-muted rounded-lg disabled:opacity-50 text-sm"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
