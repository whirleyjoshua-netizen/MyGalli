'use client'

import { useState } from 'react'
import { MessageSquare, Check, X } from 'lucide-react'

interface CommentItem {
  id: string
  authorName: string
  authorEmail: string | null
  content: string
  approved: boolean
  createdAt: string
}

interface CommentData {
  elementId: string
  type: 'comment'
  title: string
  moderated: boolean
  totalComments: number
  approvedCount: number
  pendingCount: number
  comments: CommentItem[]
  tabLabel?: string
}

export function CommentCard({ data, displayId }: { data: CommentData; displayId: string }) {
  const [comments, setComments] = useState<CommentItem[]>(data.comments)
  const [updating, setUpdating] = useState<string | null>(null)

  const handleModerate = async (commentId: string, approved: boolean) => {
    setUpdating(commentId)
    try {
      const res = await fetch(`/api/displays/${displayId}/comments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentId, approved }),
      })

      if (res.ok) {
        setComments(prev =>
          prev.map(c => c.id === commentId ? { ...c, approved } : c)
        )
      }
    } catch (error) {
      console.error('Failed to moderate comment:', error)
    } finally {
      setUpdating(null)
    }
  }

  const approvedCount = comments.filter(c => c.approved).length
  const pendingCount = comments.filter(c => !c.approved).length

  return (
    <div className="bg-muted/30 rounded-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-orange-500" />
          <h3 className="font-medium">{data.title}</h3>
          {data.tabLabel && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{data.tabLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{approvedCount} approved</span>
          {pendingCount > 0 && (
            <span className="text-yellow-600 font-medium">{pendingCount} pending</span>
          )}
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet</p>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {comments.map(comment => (
            <div
              key={comment.id}
              className={`p-3 rounded-lg border ${
                comment.approved
                  ? 'border-border bg-background'
                  : 'border-yellow-500/30 bg-yellow-500/5'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{comment.authorName}</span>
                  {!comment.approved && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-700 px-1.5 py-0.5 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.createdAt).toLocaleDateString()}
                  </span>
                  {data.moderated && (
                    <div className="flex items-center gap-1">
                      {!comment.approved && (
                        <button
                          onClick={() => handleModerate(comment.id, true)}
                          disabled={updating === comment.id}
                          className="p-1 hover:bg-green-500/20 rounded transition text-green-600"
                          title="Approve"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {comment.approved && (
                        <button
                          onClick={() => handleModerate(comment.id, false)}
                          disabled={updating === comment.id}
                          className="p-1 hover:bg-red-500/20 rounded transition text-red-500"
                          title="Reject"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
