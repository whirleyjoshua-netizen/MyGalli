export type ProjectKind = 'page' | 'collection'

export interface ProjectDisplay {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  kind: string
}

export interface ProjectCard {
  id: string
  slug: string
  title: string
  coverImage: string | null
  views: number
  kind: ProjectKind
  typeLabel: 'Page' | 'Board'
}

const INCLUDED: string[] = ['page', 'collection']

export function toProjectCards(
  displays: ProjectDisplay[],
  featuredId?: string | null,
): ProjectCard[] {
  const cards: ProjectCard[] = displays
    .filter((d) => INCLUDED.includes(d.kind))
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      coverImage: d.coverImage,
      views: d.views,
      kind: d.kind as ProjectKind,
      typeLabel: d.kind === 'collection' ? 'Board' : 'Page',
    }))
  if (!featuredId) return cards
  const featured = cards.filter((c) => c.id === featuredId)
  const rest = cards.filter((c) => c.id !== featuredId)
  return [...featured, ...rest]
}
