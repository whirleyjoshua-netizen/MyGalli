'use client'

import Link from 'next/link'
import { Wordmark } from '@/components/brand/Wordmark'

export function EnterpriseFooter() {
  return (
    <footer className="border-t border-border py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <Wordmark className="text-xl" />
            <span className="text-sm font-semibold text-muted-foreground">Enterprise</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition">Home</Link>
            <Link href="/enterprise" className="hover:text-foreground transition">Enterprise</Link>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#waitlist" className="hover:text-foreground transition">Waitlist</a>
          </div>

          {/* Copyright */}
          <div className="text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Gallio. A living gallery of you.
          </div>
        </div>
      </div>
    </footer>
  )
}
