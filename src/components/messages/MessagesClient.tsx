'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, PenSquare } from 'lucide-react'
import { usePolling } from '@/hooks/usePolling'
import type { DmConversationSummary, DmMessage } from '@/lib/types/dm'
import { MessagesInbox } from '@/components/dashboard/MessagesInbox'
import { ConversationList } from './ConversationList'
import { MessageThread } from './MessageThread'
import { MessageComposer } from './MessageComposer'
import { RequestBanner } from './RequestBanner'
import { PersonPanel } from './PersonPanel'
import { MessagesEmpty } from './MessagesEmpty'

type Tab = 'all' | 'unread' | 'requests' | 'visitor'

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'requests', label: 'Requests' },
  { id: 'visitor', label: 'Visitor notes' },
]

const LIST_INTERVAL_MS = 20_000
const THREAD_INTERVAL_MS = 5_000

export function MessagesClient({ myId }: { myId: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const activeId = params.get('c')

  const [tab, setTab] = useState<Tab>('all')
  const [conversations, setConversations] = useState<DmConversationSummary[]>([])
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)
  // Retains the last conversation summary the user was actually viewing, so
  // that a filtered list (Unread/Requests) dropping the row out from under
  // the reader does not blank the open thread mid-read.
  const [retainedActive, setRetainedActive] = useState<DmConversationSummary | null>(null)

  const filteredActive = conversations.find((c) => c.id === activeId) || null
  const active =
    filteredActive ||
    (retainedActive && retainedActive.id === activeId ? retainedActive : null)

  useEffect(() => {
    if (filteredActive) setRetainedActive(filteredActive)
    else if (!activeId) setRetainedActive(null)
  }, [filteredActive, activeId])

  // Tracks the currently-selected conversation so in-flight fetches can tell,
  // after their await resolves, whether the user has since switched away.
  // A closed-over `activeId` would be stale; this ref is always current.
  const activeIdRef = useRef(activeId)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const loadConversations = useCallback(async () => {
    const res = await fetch(`/api/dm/conversations?filter=${tab === 'visitor' ? 'all' : tab}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('list failed')
    const data = await res.json()
    setConversations(Array.isArray(data.conversations) ? data.conversations : [])
  }, [tab])

  const loadThread = useCallback(async () => {
    if (!activeId) return
    const requestedFor = activeId
    const res = await fetch(`/api/dm/conversations/${activeId}/messages`, { cache: 'no-store' })
    // The selection may have moved on while this request was in flight; a
    // response for a conversation the user is no longer viewing must never
    // overwrite the thread they're now looking at.
    if (activeIdRef.current !== requestedFor) return
    // A stale or hand-typed ?c= must not leave the reader staring at a blank
    // column — say so and drop the selection.
    if (res.status === 404) {
      setMissing(true)
      return
    }
    if (!res.ok) throw new Error('thread failed')
    setMissing(false)
    const data = await res.json()
    if (activeIdRef.current !== requestedFor) return
    setMessages(Array.isArray(data.messages) ? data.messages : [])
  }, [activeId])

  // Poll only for new messages once the thread is loaded, so a long transcript
  // is not re-fetched every 5 seconds.
  const pollThread = useCallback(async () => {
    if (!activeId) return
    const requestedFor = activeId
    const newest = [...messages].reverse().find((m) => !m.pending && !m.failed)
    const qs = newest ? `?after=${encodeURIComponent(newest.createdAt)}` : ''
    const res = await fetch(`/api/dm/conversations/${activeId}/messages${qs}`, { cache: 'no-store' })
    if (activeIdRef.current !== requestedFor) return
    if (!res.ok) throw new Error('poll failed')
    const data = await res.json()
    if (activeIdRef.current !== requestedFor) return
    const incoming: DmMessage[] = Array.isArray(data.messages) ? data.messages : []
    if (incoming.length === 0) return
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id))
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))]
    })
    // Re-stamp lastReadAt so a thread the reader is actively watching stays
    // marked read as new messages arrive, not just at the moment it's opened.
    if (!document.hidden) {
      fetch(`/api/dm/conversations/${requestedFor}/read`, { method: 'POST' }).catch(() => {})
    }
  }, [activeId, messages])

  useEffect(() => {
    setLoadingList(true)
    loadConversations()
      .catch(() => {})
      .finally(() => setLoadingList(false))
  }, [loadConversations])

  useEffect(() => {
    setMessages([])
    setMissing(false)
    if (!activeId) return
    loadThread().catch(() => {})
    fetch(`/api/dm/conversations/${activeId}/read`, { method: 'POST' }).catch(() => {})
  }, [activeId, loadThread])

  const { failures } = usePolling(loadConversations, {
    intervalMs: LIST_INTERVAL_MS,
    enabled: tab !== 'visitor',
  })
  usePolling(pollThread, { intervalMs: THREAD_INTERVAL_MS, enabled: !!activeId })

  const select = (id: string) => router.push(`/messages?c=${id}`)
  const clearSelection = () => router.push('/messages')

  const deliver = useCallback(
    async (optimistic: DmMessage) => {
      try {
        const res = await fetch(`/api/dm/conversations/${optimistic.conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: optimistic.body }),
        })
        if (!res.ok) throw new Error('send failed')
        const data = await res.json()
        // If the user has since navigated away from this conversation, the
        // messages array no longer belongs to it -- do not write into it.
        if (activeIdRef.current !== optimistic.conversationId) return
        setMessages((prev) => {
          // A poll may have already inserted this same server message while
          // the POST was in flight. Drop that copy before swapping in the
          // optimistic entry so exactly one entry for this id survives, in
          // the optimistic entry's position.
          const withoutServerCopy = prev.filter((m) => m.id !== data.message.id)
          return withoutServerCopy.map((m) => (m.id === optimistic.id ? data.message : m))
        })
      } catch {
        if (activeIdRef.current !== optimistic.conversationId) {
          // The user navigated away before the send failed. There is no
          // pending bubble left to mark failed -- surface it so the failure
          // is not silently dropped.
          console.error('Message failed to send after navigating away from the conversation.')
          return
        }
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, pending: false, failed: true } : m))
        )
      }
    },
    []
  )

  const send = (body: string) => {
    if (!activeId) return
    const optimistic: DmMessage = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      conversationId: activeId,
      senderId: myId,
      kind: 'text',
      body,
      mediaUrl: null,
      createdAt: new Date().toISOString(),
      pending: true,
    }
    setMessages((prev) => [...prev, optimistic])
    void deliver(optimistic)
  }

  const retry = (m: DmMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, failed: false, pending: true } : x)))
    void deliver({ ...m, failed: false, pending: true })
  }

  const startConversation = async () => {
    const username = window.prompt('Message which member? Enter their username.')?.trim()
    if (!username) return
    setBusy(true)
    try {
      const res = await fetch('/api/dm/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) {
        window.alert(res.status === 404 ? 'No member with that username.' : 'Could not start that conversation.')
        return
      }
      const data = await res.json()
      // Navigate first: the conversation was already created successfully,
      // so a blip refreshing the list must not surface a create-failed error.
      router.push(`/messages?c=${data.id}`)
      loadConversations().catch(() => {})
    } catch {
      window.alert('Could not start that conversation.')
    } finally {
      setBusy(false)
    }
  }

  const setState = async (state: 'accepted' | 'blocked') => {
    if (!activeId) return
    setBusy(true)
    try {
      await fetch(`/api/dm/conversations/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      })
      if (state === 'blocked') clearSelection()
      // An accepted request no longer matches the Requests filter; move to
      // All so the just-accepted thread stays visible instead of vanishing.
      if (state === 'accepted') setTab('all')
      await loadConversations()
    } catch {
      // The row stays as-is; the next poll reconciles.
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 pb-10 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? 'bg-galli text-white'
                : 'border border-border bg-surface text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={startConversation}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-galli px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          <PenSquare className="h-4 w-4" /> New Message
        </button>
      </div>

      {failures >= 3 && (
        <p className="mb-3 text-xs text-muted-foreground">Reconnecting…</p>
      )}

      {tab === 'visitor' ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <MessagesInbox />
        </div>
      ) : (
        <div className="flex h-[calc(100vh-16rem)] min-h-[520px] overflow-hidden rounded-2xl border border-border bg-surface">
          <div className={`w-full shrink-0 border-r border-border lg:w-[320px] ${activeId ? 'hidden lg:block' : 'block'}`}>
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              onSelect={select}
              loading={loadingList}
            />
          </div>

          <div className={`min-w-0 flex-1 flex-col ${activeId ? 'flex' : 'hidden lg:flex'}`}>
            {missing ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <p className="text-sm font-bold">This conversation isn&apos;t available</p>
                <button
                  onClick={clearSelection}
                  className="rounded-full border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
                >
                  Back to inbox
                </button>
              </div>
            ) : active ? (
              <>
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-1 border-b border-border px-4 py-2 text-sm text-muted-foreground lg:hidden"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <MessageThread
                  messages={messages}
                  myId={myId}
                  conversation={active}
                  onRetry={retry}
                />
                {active.state === 'requested' ? (
                  <RequestBanner
                    name={active.other.name || `@${active.other.username}`}
                    onAccept={() => setState('accepted')}
                    onIgnore={() => setState('blocked')}
                    busy={busy}
                  />
                ) : (
                  <MessageComposer onSend={send} disabled={active.state === 'blocked'} />
                )}
              </>
            ) : (
              <MessagesEmpty variant={conversations.length === 0 ? 'inbox' : 'thread'} />
            )}
          </div>

          {active && <PersonPanel conversation={active} />}
        </div>
      )}
    </div>
  )
}
