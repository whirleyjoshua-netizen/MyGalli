// Pure builders for social share intent URLs (Model A — pre-filled composers).
// The caller passes an already-absolute page URL (built from window.location.origin).

export function buildShareText(title: string): string {
  const t = title.trim()
  return t ? `Check out "${t}" on My Galli` : 'Check out this page on My Galli'
}

export function xShareUrl(url: string, text: string): string {
  const params = new URLSearchParams({ text, url })
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function facebookShareUrl(url: string): string {
  const params = new URLSearchParams({ u: url })
  return `https://www.facebook.com/sharer/sharer.php?${params.toString()}`
}

export function linkedInShareUrl(url: string): string {
  const params = new URLSearchParams({ url })
  return `https://www.linkedin.com/sharing/share-offsite/?${params.toString()}`
}
