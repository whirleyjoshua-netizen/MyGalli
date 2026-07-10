export interface BizDay { day: string; open: string; close: string; closed: boolean }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function parseTimeToMinutes(s: string): number | null {
  if (!s) return null
  const m = s.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const mer = m[3].toUpperCase()
  if (h < 1 || h > 12 || min > 59) return null
  if (mer === 'AM') h = h === 12 ? 0 : h
  else h = h === 12 ? 12 : h + 12
  return h * 60 + min
}

export function isOpenNow(schedule: BizDay[], now: Date): { open: boolean; label: string } {
  const dayName = DAY_NAMES[now.getDay()]
  const today = schedule.find((d) => d.day === dayName)
  if (!today || today.closed) return { open: false, label: 'Closed' }
  const openM = parseTimeToMinutes(today.open)
  const closeM = parseTimeToMinutes(today.close)
  if (openM === null || closeM === null) return { open: false, label: 'Closed' }
  const nowM = now.getHours() * 60 + now.getMinutes()
  if (nowM >= openM && nowM < closeM) return { open: true, label: `Open now · until ${today.close}` }
  if (nowM < openM) return { open: false, label: `Closed · opens ${today.open}` }
  return { open: false, label: 'Closed' }
}
