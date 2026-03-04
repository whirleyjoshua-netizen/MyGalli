'use client'

import { useState } from 'react'
import { Trash2, Plus, Calendar, Upload, X } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface GameEntry {
  date: string
  opponent: string
  location: string
  homeAway: 'Home' | 'Away' | 'Neutral'
  time: string
  result?: string
}

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function GameScheduleElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState('')

  const title = element.gameScheduleTitle || 'Game Schedule'
  const games: GameEntry[] = element.gameScheduleGames || []

  const updateGame = (index: number, field: keyof GameEntry, value: string) => {
    const updated = games.map((g, i) =>
      i === index ? { ...g, [field]: value } : g
    )
    onChange({ gameScheduleGames: updated })
  }

  const addGame = () => {
    onChange({
      gameScheduleGames: [
        ...games,
        { date: '', opponent: '', location: '', homeAway: 'Home' as const, time: '' },
      ],
    })
  }

  const removeGame = (index: number) => {
    onChange({ gameScheduleGames: games.filter((_, i) => i !== index) })
  }

  const handleImportCSV = () => {
    if (!csvText.trim()) return
    const lines = csvText.trim().split('\n')
    const parsed: GameEntry[] = []

    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      // Skip header row if detected
      if (i === 0 && cols[0]?.toLowerCase().includes('date')) continue

      parsed.push({
        date: cols[0] || '',
        opponent: cols[1] || '',
        location: cols[2] || '',
        homeAway: (['Home', 'Away', 'Neutral'].includes(cols[3]) ? cols[3] : 'Home') as GameEntry['homeAway'],
        time: cols[4] || '',
        result: cols[5] || '',
      })
    }

    if (parsed.length > 0) {
      onChange({ gameScheduleGames: [...games, ...parsed] })
      setCsvText('')
      setShowImport(false)
    }
  }

  return (
    <div
      className={`relative rounded-xl border transition-all ${
        isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-border/80'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      {/* Controls */}
      {isSelected && (
        <div className="absolute -top-3 right-2 flex items-center gap-1 z-10">
          <button
            onClick={(e) => { e.stopPropagation(); setShowImport(!showImport) }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-muted transition"
            title="Import CSV"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-destructive/10 hover:text-destructive transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="p-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <input
            type="text"
            value={title}
            onChange={(e) => onChange({ gameScheduleTitle: e.target.value })}
            className="text-lg font-semibold bg-transparent border-none outline-none flex-1"
            placeholder="Game Schedule"
          />
        </div>

        {/* CSV Import Panel */}
        {showImport && (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Import from CSV</span>
              <button onClick={() => setShowImport(false)} className="p-1 hover:bg-muted rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Paste CSV with columns: Date, Opponent, Location, Home/Away, Time, Result
            </p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full h-24 text-xs bg-background border border-border rounded-lg p-2 font-mono resize-none outline-none focus:ring-1 focus:ring-primary"
              placeholder="2025-09-05, Central High, Memorial Stadium, Home, 7:00 PM, W 28-14"
            />
            <button
              onClick={handleImportCSV}
              className="mt-2 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-full hover:opacity-90 transition"
            >
              Import Games
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 pr-2 font-medium text-muted-foreground text-xs w-28">Date</th>
                <th className="pb-2 pr-2 font-medium text-muted-foreground text-xs">Opponent</th>
                <th className="pb-2 pr-2 font-medium text-muted-foreground text-xs">Location</th>
                <th className="pb-2 pr-2 font-medium text-muted-foreground text-xs w-24">Home/Away</th>
                <th className="pb-2 pr-2 font-medium text-muted-foreground text-xs w-24">Time</th>
                <th className="pb-2 pr-2 font-medium text-muted-foreground text-xs w-20">Result</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {games.map((game, i) => (
                <tr key={i} className="border-b border-border/50 group/row">
                  <td className="py-1.5 pr-2">
                    <input
                      type="date"
                      value={game.date}
                      onChange={(e) => updateGame(i, 'date', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={game.opponent}
                      onChange={(e) => updateGame(i, 'opponent', e.target.value)}
                      placeholder="vs. Opponent"
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={game.location}
                      onChange={(e) => updateGame(i, 'location', e.target.value)}
                      placeholder="Location"
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      value={game.homeAway}
                      onChange={(e) => updateGame(i, 'homeAway', e.target.value)}
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1 py-1 text-xs outline-none"
                    >
                      <option value="Home">Home</option>
                      <option value="Away">Away</option>
                      <option value="Neutral">Neutral</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={game.time}
                      onChange={(e) => updateGame(i, 'time', e.target.value)}
                      placeholder="7:00 PM"
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="text"
                      value={game.result || ''}
                      onChange={(e) => updateGame(i, 'result', e.target.value)}
                      placeholder="W/L"
                      className="w-full bg-transparent border border-transparent hover:border-border focus:border-primary rounded px-1.5 py-1 text-xs outline-none"
                    />
                  </td>
                  <td className="py-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeGame(i) }}
                      className="p-1 opacity-0 group-hover/row:opacity-100 hover:text-destructive transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Game */}
        <button
          onClick={(e) => { e.stopPropagation(); addGame() }}
          className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Game
        </button>
      </div>
    </div>
  )
}
