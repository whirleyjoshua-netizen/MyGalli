'use client'

import { Users, UserCheck, UserX, UtensilsCrossed, Music, AlertCircle } from 'lucide-react'

interface WeddingRsvpData {
  elementId: string
  type: 'wedding-rsvp'
  title: string
  responseCount: number
  attending: number
  declined: number
  plusOnes: number
  totalHeadcount: number
  mealDistribution: { meal: string; count: number; percentage: number }[]
  dietaryNotes: string[]
  songRequests: string[]
  guests: { name: string; attending: boolean; meal?: string; plusOneName?: string; submittedAt: string }[]
  tabLabel?: string
}

interface Props {
  data: WeddingRsvpData
}

export function WeddingRsvpCard({ data }: Props) {
  return (
    <div className="bg-background border border-border rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">{data.title}</h3>
          {data.tabLabel && (
            <span className="text-xs text-muted-foreground">Tab: {data.tabLabel}</span>
          )}
        </div>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {data.responseCount} {data.responseCount === 1 ? 'response' : 'responses'}
        </span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <UserCheck className="w-5 h-5 text-green-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-green-700">{data.attending}</div>
          <div className="text-xs text-green-600">Attending</div>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <UserX className="w-5 h-5 text-red-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-red-600">{data.declined}</div>
          <div className="text-xs text-red-500">Declined</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <Users className="w-5 h-5 text-blue-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-blue-700">{data.plusOnes}</div>
          <div className="text-xs text-blue-600">Plus Ones</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <Users className="w-5 h-5 text-purple-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-purple-700">{data.totalHeadcount}</div>
          <div className="text-xs text-purple-600">Total Headcount</div>
        </div>
      </div>

      {/* Meal Distribution */}
      {data.mealDistribution.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Meal Choices</span>
          </div>
          <div className="space-y-2">
            {data.mealDistribution.map((item) => (
              <div key={item.meal} className="flex items-center gap-3">
                <div className="w-24 text-sm text-muted-foreground truncate">{item.meal}</div>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-300 to-rose-400 transition-all"
                    style={{ width: `${Math.max(item.percentage, 4)}%` }}
                  />
                </div>
                <div className="w-16 text-right text-sm font-medium text-foreground">
                  {item.count} ({item.percentage}%)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dietary Notes */}
      {data.dietaryNotes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Dietary Notes</span>
          </div>
          <div className="space-y-1">
            {data.dietaryNotes.map((note, i) => (
              <div key={i} className="text-sm text-muted-foreground bg-muted/50 rounded px-3 py-1.5">
                {note}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Song Requests */}
      {data.songRequests.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Song Requests</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.songRequests.map((song, i) => (
              <span key={i} className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                {song}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Guest List */}
      {data.guests.length > 0 && (
        <div>
          <span className="text-sm font-medium text-foreground">Guest List</span>
          <div className="mt-2 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Meal</th>
                  <th className="px-3 py-2 text-left font-medium">+1</th>
                </tr>
              </thead>
              <tbody>
                {data.guests.map((guest, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2">{guest.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        guest.attending
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {guest.attending ? 'Attending' : 'Declined'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{guest.meal || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{guest.plusOneName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
