'use client'

import { Star, MessageSquare } from 'lucide-react'

interface ReviewEntry {
  name: string
  rating: number
  text: string
  submittedAt: string
}

interface BusinessReviewData {
  elementId: string
  type: 'business-review'
  title: string
  responseCount: number
  averageRating: number
  ratingDistribution: { value: number; count: number }[]
  recentReviews: ReviewEntry[]
  tabLabel?: string
}

export function BusinessReviewCard({ data }: { data: BusinessReviewData }) {
  return (
    <div className="bg-muted/30 rounded-lg p-6 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-amber-500" />
          <h3 className="font-medium">{data.title}</h3>
          {data.tabLabel && (
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{data.tabLabel}</span>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {data.responseCount} review{data.responseCount !== 1 ? 's' : ''}
        </span>
      </div>

      {data.responseCount === 0 ? (
        <p className="text-sm text-muted-foreground">No visitor reviews yet</p>
      ) : (
        <>
          {/* Average rating */}
          <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 rounded-lg">
            <div className="text-3xl font-bold text-amber-600">{data.averageRating}</div>
            <div>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={`w-4 h-4 ${i <= Math.round(data.averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-0.5">Average rating</p>
            </div>
          </div>

          {/* Rating distribution */}
          <div className="space-y-1 mb-4">
            {data.ratingDistribution.map(({ value, count }) => (
              <div key={value} className="flex items-center gap-2 text-xs">
                <span className="w-6 text-right">{value}★</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${data.responseCount > 0 ? (count / data.responseCount) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-6 text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>

          {/* Recent reviews */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentReviews.map((review, i) => (
              <div key={i} className="py-2 border-b border-border last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{review.name}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(j => (
                        <Star key={j} className={`w-3 h-3 ${j <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                      ))}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(review.submittedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground">{review.text}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
