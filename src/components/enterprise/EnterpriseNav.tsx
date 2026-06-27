'use client';

import Image from 'next/image';

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'For Teams', href: '#for-teams' },
  { label: 'For Schools', href: '#for-schools' },
  { label: 'Pricing', href: '#pricing' },
];

function smoothScroll(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  e.preventDefault();
  const target = document.querySelector(href);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

export default function EnterpriseNav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Left: Logo + Brand + Badge */}
        <div className="flex items-center gap-3">
          <Image
            src="/gallio-frog.svg"
            alt="Gallio"
            width={32}
            height={32}
            className="shrink-0"
          />
          <span className="text-lg font-bold text-foreground">Gallio</span>
          <span className="rounded-full bg-galli/15 px-2.5 py-0.5 text-xs font-semibold text-galli-dark">
            Enterprise
          </span>
        </div>

        {/* Center/Right: Nav Links */}
        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => smoothScroll(e, link.href)}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Far Right: CTA */}
        <a
          href="#waitlist"
          onClick={(e) => smoothScroll(e, '#waitlist')}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:scale-[1.02] hover:shadow-md hover:shadow-galli/25"
        >
          Join Waitlist
        </a>
      </div>
    </nav>
  );
}
