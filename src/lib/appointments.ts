// src/lib/appointments.ts
export interface ApptRule { day: number; start: string; end: string } // day 0=Sun..6=Sat, 'HH:MM'
export interface AppointmentConfig {
  duration: number
  timezone: string
  weeklyRules: ApptRule[]
  buffer: number
  leadTimeHours: number
  maxDaysAhead: number
}
export interface Slot { startUTC: string; endUTC: string }

const MS_MIN = 60_000
const MS_DAY = 86_400_000

// Minutes to ADD to a UTC instant to get wall-clock in timeZone.
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(at)
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = parseInt(p.value, 10)
  // asUTC = the wall-clock numbers interpreted as if they were UTC
  const asUTC = Date.UTC(map.year, map.month - 1, map.day, map.hour === 24 ? 0 : map.hour, map.minute, map.second)
  return Math.round((asUTC - at.getTime()) / MS_MIN)
}

// Convert a wall-clock time in timeZone to the corresponding UTC instant.
export function wallClockToUTC(timeZone: string, year: number, month1: number, day: number, hour: number, min: number): Date {
  // First guess: treat wall clock as UTC, then correct by that instant's offset.
  const guess = new Date(Date.UTC(year, month1 - 1, day, hour, min))
  const offset = tzOffsetMinutes(timeZone, guess)
  let utc = new Date(guess.getTime() - offset * MS_MIN)
  // Re-check once for DST edges (offset may differ at the corrected instant).
  const offset2 = tzOffsetMinutes(timeZone, utc)
  if (offset2 !== offset) utc = new Date(guess.getTime() - offset2 * MS_MIN)
  return utc
}

const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m }

// Local Y/M/D in timeZone for a UTC instant.
function localYMD(timeZone: string, at: Date): { y: number; m: number; d: number; wd: number } {
  const off = tzOffsetMinutes(timeZone, at)
  const local = new Date(at.getTime() + off * MS_MIN)
  return { y: local.getUTCFullYear(), m: local.getUTCMonth() + 1, d: local.getUTCDate(), wd: local.getUTCDay() }
}

export function generateSlots(config: AppointmentConfig, fromUTC: Date, toUTC: Date, nowUTC: Date): Slot[] {
  const slots: Slot[] = []
  const step = config.duration + Math.max(0, config.buffer)
  const leadMs = config.leadTimeHours * 60 * MS_MIN
  const earliest = nowUTC.getTime() + leadMs
  const latest = nowUTC.getTime() + config.maxDaysAhead * MS_DAY

  // Iterate calendar days spanning the window (pad ±1 day for tz edges).
  for (let t = fromUTC.getTime() - MS_DAY; t <= toUTC.getTime() + MS_DAY; t += MS_DAY) {
    const { y, m, d, wd } = localYMD(config.timezone, new Date(t))
    for (const rule of config.weeklyRules) {
      if (rule.day !== wd) continue
      const startMin = hm(rule.start)
      const endMin = hm(rule.end)
      for (let mins = startMin; mins + config.duration <= endMin; mins += step) {
        const startUTC = wallClockToUTC(config.timezone, y, m, d, Math.floor(mins / 60), mins % 60)
        const endUTC = new Date(startUTC.getTime() + config.duration * MS_MIN)
        const ts = startUTC.getTime()
        if (ts < fromUTC.getTime() || ts >= toUTC.getTime()) continue
        if (ts < earliest || ts > latest) continue
        slots.push({ startUTC: startUTC.toISOString(), endUTC: endUTC.toISOString() })
      }
    }
  }
  // Dedup + sort (tz padding can double-count a boundary day).
  const seen = new Set<string>()
  return slots
    .filter((s) => (seen.has(s.startUTC) ? false : (seen.add(s.startUTC), true)))
    .sort((a, b) => a.startUTC.localeCompare(b.startUTC))
}

export function isSlotBookable(config: AppointmentConfig, startUTC: string, nowUTC: Date): boolean {
  const target = new Date(startUTC)
  if (isNaN(target.getTime())) return false
  // Window: from now to maxDaysAhead+1, generate and check membership.
  const from = new Date(nowUTC.getTime())
  const to = new Date(nowUTC.getTime() + (config.maxDaysAhead + 1) * MS_DAY)
  return generateSlots(config, from, to, nowUTC).some((s) => s.startUTC === target.toISOString())
}
