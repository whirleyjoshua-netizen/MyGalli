export type PondCommunity = {
  id: string; title: string; username: string; slug: string
  coverImage: string | null; role: 'owner' | 'member'; memberCount: number
  latestPost: { text: string | null; createdAt: string } | null
  updatedAt: string
}

export type PondCollab = {
  id: string; slug: string; title: string; coverImage: string | null
  published: boolean; updatedAt: string
  owner: { username: string; name: string | null; avatar: string | null }
}

export type PondFilter = 'all' | 'owned' | 'joined'
export type PondSort = 'active' | 'newest' | 'alpha' | 'members'

export function communityActivityTs(c: PondCommunity): number {
  return new Date(c.latestPost?.createdAt ?? c.updatedAt).getTime()
}

export function filterSortCommunities(
  list: PondCommunity[],
  opts: { query: string; filter: PondFilter; sort: PondSort },
): PondCommunity[] {
  const q = opts.query.trim().toLowerCase()
  let out = list.filter((c) => {
    if (opts.filter === 'owned' && c.role !== 'owner') return false
    if (opts.filter === 'joined' && c.role !== 'member') return false
    if (q && !c.title.toLowerCase().includes(q)) return false
    return true
  })
  out = [...out].sort((a, b) => {
    switch (opts.sort) {
      case 'alpha': return a.title.localeCompare(b.title)
      case 'members': return b.memberCount - a.memberCount
      case 'newest': return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      case 'active':
      default: return communityActivityTs(b) - communityActivityTs(a)
    }
  })
  return out
}

export function filterSortCollabs(
  list: PondCollab[],
  opts: { query: string; sort: PondSort },
): PondCollab[] {
  const q = opts.query.trim().toLowerCase()
  let out = list.filter((d) => !q || d.title.toLowerCase().includes(q))
  out = [...out].sort((a, b) => {
    if (opts.sort === 'alpha') return a.title.localeCompare(b.title)
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
  return out
}
