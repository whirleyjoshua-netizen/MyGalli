export type FileKind = 'pdf' | 'image' | 'other'

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

function extname(url: string): string {
  // strip query/hash, then take the trailing .ext, lowercased
  const path = url.split(/[?#]/)[0]
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot).toLowerCase()
}

export function fileKind(input: { type?: string | null; url?: string | null }): FileKind {
  const type = (input.type ?? '').toLowerCase()
  const ext = input.url ? extname(input.url) : ''
  if (type === 'pdf' || ext === '.pdf') return 'pdf'
  if (type === 'image' || IMAGE_EXT.includes(ext)) return 'image'
  return 'other'
}
