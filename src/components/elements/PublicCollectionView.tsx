import Link from 'next/link'
import type { CanvasElement } from '@/lib/types/canvas'

const COLS: Record<number, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-4',
}

export function PublicCollectionView({ element }: { element: CanvasElement }) {
  const members = element.collectionMembers || []
  const cols = COLS[element.collectionColumns || 3] || COLS[3]

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
        No pages yet
      </div>
    )
  }

  return (
    <div className={`grid ${cols} gap-4`}>
      {members.map((m) => (
        <Link
          key={m.id}
          href={`/${m.username}/${m.slug}`}
          className="group block h-56 rounded-xl border border-border/50 overflow-hidden shadow-sm hover:shadow-md hover:border-galli/30 transition-all"
        >
          <div className="relative h-full w-full bg-gradient-to-br from-galli/15 via-galli-aqua/8 to-transparent">
            {m.coverImage && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={m.coverImage} alt="" className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
            )}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            {element.collectionShowCategory && m.category && (
              <span className="absolute top-2 left-2 rounded-full bg-black/50 px-2 py-0.5 text-xs text-white backdrop-blur-sm capitalize">
                {m.category}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-3">
              <h3 className="truncate text-base font-semibold text-white drop-shadow">{m.title}</h3>
              {element.collectionShowDescription && m.description && (
                <p className="mt-1 line-clamp-2 text-sm text-white/80 drop-shadow">{m.description}</p>
              )}
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
