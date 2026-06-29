import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'

const FOOTER_LINKS = [
  { label: 'About', href: '#' },
  { label: 'Careers', href: '#' },
  { label: 'Privacy', href: '#' },
  { label: 'Terms', href: '#' },
  { label: 'Contact', href: '#' },
]

function Social({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      aria-label={label}
      className="text-muted-foreground transition hover:text-foreground"
    >
      {children}
    </a>
  )
}

export function LandingFooter() {
  return (
    <footer className="relative z-10 mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col items-center justify-between gap-6 border-t border-border pt-6 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>© 2026</span>
          <Wordmark className="text-base" />
          <span>Labs</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-muted-foreground transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Social href="#" label="Twitter / X">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </Social>
          <Social href="#" label="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
          </Social>
          <Social href="#" label="Discord">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a14.07 14.07 0 0 0-.642 1.32 18.27 18.27 0 0 0-5.487 0A12.6 12.6 0 0 0 9.78 3.2a19.74 19.74 0 0 0-3.76 1.169C3.46 8.21 2.81 11.96 3.13 15.66a19.93 19.93 0 0 0 6.06 3.06c.49-.67.93-1.38 1.31-2.12-.72-.27-1.41-.6-2.06-.99.17-.13.34-.26.5-.4a14.23 14.23 0 0 0 12.12 0c.16.14.33.27.5.4-.65.39-1.34.72-2.07.99.38.74.82 1.45 1.31 2.12a19.9 19.9 0 0 0 6.06-3.06c.38-4.28-.65-8-2.74-11.29ZM9.55 13.42c-.9 0-1.64-.83-1.64-1.85s.72-1.85 1.64-1.85c.92 0 1.66.84 1.64 1.85 0 1.02-.73 1.85-1.64 1.85Zm4.9 0c-.9 0-1.64-.83-1.64-1.85s.72-1.85 1.64-1.85c.92 0 1.66.84 1.64 1.85 0 1.02-.72 1.85-1.64 1.85Z" />
            </svg>
          </Social>
        </div>
      </div>
    </footer>
  )
}
