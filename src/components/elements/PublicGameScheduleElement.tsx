'use client'

import { Calendar } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
}

export function PublicGameScheduleElement({ element }: Props) {
  const title = element.gameScheduleTitle || 'Game Schedule'
  const games = element.gameScheduleGames || []
  const showPast = element.gameScheduleShowPastGames !== false

  const today = new Date().toISOString().split('T')[0]

  const filteredGames = showPast
    ? games
    : games.filter(g => !g.date || g.date >= today)

  if (filteredGames.length === 0) {
    return (
      <div className="rounded-2xl border border-border/50 bg-white/50 p-8 text-center">
        <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No games scheduled yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/50 bg-white/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/50 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-lg">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-left">
              <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Opponent</th>
              <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Location</th>
              <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Time</th>
              <th className="px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wider">Result</th>
            </tr>
          </thead>
          <tbody>
            {filteredGames.map((game, i) => {
              const isPast = game.date && game.date < today
              const homeAwayColor = game.homeAway === 'Home'
                ? 'bg-primary/10 text-primary'
                : game.homeAway === 'Away'
                ? 'bg-violet-100 text-violet-700'
                : 'bg-muted text-muted-foreground'

              return (
                <tr
                  key={i}
                  className={`border-b border-border/30 ${isPast ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">
                    {game.date ? new Date(game.date + 'T00:00:00').toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{game.opponent || '—'}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${homeAwayColor}`}>
                        {game.homeAway}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{game.location || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{game.time || '—'}</td>
                  <td className="px-4 py-3">
                    {game.result ? (
                      <span className={`font-semibold ${
                        game.result.startsWith('W') ? 'text-green-600' :
                        game.result.startsWith('L') ? 'text-red-500' :
                        'text-muted-foreground'
                      }`}>
                        {game.result}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
