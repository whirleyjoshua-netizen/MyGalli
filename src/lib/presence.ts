type Entry = { id: string; name: string | null; avatar: string | null; lastSeen: number }
const rooms = new Map<string, Map<string, Entry>>()
const WINDOW = 15_000

export function touch(displayId: string, user: { id: string; name: string | null; avatar: string | null }) {
  let room = rooms.get(displayId)
  if (!room) {
    room = new Map()
    rooms.set(displayId, room)
  }
  room.set(user.id, { id: user.id, name: user.name, avatar: user.avatar, lastSeen: Date.now() })
}

export function active(displayId: string): Array<{ id: string; name: string | null; avatar: string | null }> {
  const room = rooms.get(displayId)
  if (!room) return []
  const now = Date.now()
  const out: Array<{ id: string; name: string | null; avatar: string | null }> = []
  for (const [uid, e] of room) {
    if (now - e.lastSeen > WINDOW) room.delete(uid)
    else out.push({ id: e.id, name: e.name, avatar: e.avatar })
  }
  return out
}
