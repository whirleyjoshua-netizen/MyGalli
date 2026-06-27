'use client';

import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';

function smoothScroll(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
  e.preventDefault();
  const target = document.querySelector(href);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth' });
  }
}

export default function HeroSection() {
  useEffect(() => {
    const id = 'galli-hero-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes galli-float {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-30px) scale(1.05); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden px-6">
      {/* Animated blur background circles */}
      <div
        className="pointer-events-none absolute left-1/4 top-1/4 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-galli/30 blur-3xl"
        aria-hidden="true"
        style={{ animation: 'galli-float 8s ease-in-out infinite' }}
      />
      <div
        className="pointer-events-none absolute right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-galli-aqua/20 blur-3xl"
        aria-hidden="true"
        style={{ animation: 'galli-float 10s ease-in-out infinite reverse' }}
      />
      <div
        className="pointer-events-none absolute bottom-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-galli-violet/20 blur-3xl"
        aria-hidden="true"
        style={{ animation: 'galli-float 12s ease-in-out infinite' }}
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        {/* Early Access Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm">
          <Sparkles className="h-4 w-4 text-galli" />
          Now in Early Access
        </div>

        {/* Main Heading */}
        <h1 className="text-galli-gradient text-5xl font-extrabold tracking-tight md:text-7xl">
          The Operating System
          <br />
          for Student Identity
        </h1>

        {/* Subheading */}
        <p className="mx-auto mt-6 max-w-3xl text-xl text-muted-foreground">
          Galli Enterprise gives schools, athletic programs, and districts a
          structured platform to track student growth, showcase achievements, and
          build digital identities — from freshman year to graduation.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="#waitlist"
            onClick={(e) => smoothScroll(e, '#waitlist')}
            className="rounded-full bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-galli/25"
          >
            Join the Waitlist
          </a>
          <a
            href="#how-it-works"
            onClick={(e) => smoothScroll(e, '#how-it-works')}
            className="rounded-full border border-border px-8 py-4 text-lg text-foreground transition-colors hover:bg-muted"
          >
            See How It Works
          </a>
        </div>
      </div>

    </section>
  );
}
