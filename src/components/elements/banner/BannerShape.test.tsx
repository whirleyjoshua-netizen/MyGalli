import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BannerShape } from './BannerShape'
import type { BannerPreset } from '@/lib/types/canvas'

const ALL: BannerPreset[] = ['ribbon', 'pennant', 'crest', 'strip', 'notice', 'hero', 'band']

describe('BannerShape', () => {
  it.each(ALL)('renders the %s preset with its heading', (preset) => {
    render(<BannerShape preset={preset} heading={`H-${preset}`} />)
    expect(screen.getByText(`H-${preset}`)).toBeInTheDocument()
  })

  it('renders subtext when present and omits it when blank', () => {
    const { rerender } = render(<BannerShape preset="hero" heading="Hi" subtext="Sub" />)
    expect(screen.getByText('Sub')).toBeInTheDocument()
    rerender(<BannerShape preset="hero" heading="Hi" subtext="" />)
    expect(screen.queryByText('Sub')).not.toBeInTheDocument()
  })

  it('renders the link only when BOTH label and url are set', () => {
    const { rerender } = render(
      <BannerShape preset="strip" heading="Hi" linkLabel="Go" linkUrl="https://x.test" />
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', 'https://x.test')

    rerender(<BannerShape preset="strip" heading="Hi" linkLabel="Go" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    rerender(<BannerShape preset="strip" heading="Hi" linkUrl="https://x.test" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('neutralizes a javascript: link url', () => {
    render(
      <BannerShape preset="strip" heading="Hi" linkLabel="Go" linkUrl="javascript:alert(1)" />
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders headingNode instead of heading when provided', () => {
    render(
      <BannerShape preset="band" heading="plain" headingNode={<span>edited</span>} />
    )
    expect(screen.getByText('edited')).toBeInTheDocument()
    expect(screen.queryByText('plain')).not.toBeInTheDocument()
  })

  it('applies a scrim for image fills but not for token fills', () => {
    const { container: img } = render(
      <BannerShape preset="hero" heading="Hi" fillKind="image" fillValue="https://b.test/a.jpg" />
    )
    expect(img.querySelector('[data-banner-scrim]')).not.toBeNull()

    const { container: tok } = render(
      <BannerShape preset="hero" heading="Hi" fillKind="token" fillValue="primary" />
    )
    expect(tok.querySelector('[data-banner-scrim]')).toBeNull()
  })

  it('renders a navigable link by default', () => {
    render(
      <BannerShape preset="strip" heading="Hi" linkLabel="Go" linkUrl="https://x.test" />
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', 'https://x.test')
  })

  it('renders hero as an h2 heading, and strip as a non-heading div', () => {
    const { rerender } = render(<BannerShape preset="hero" heading="Big headline" />)
    expect(screen.getByText('Big headline').tagName).toBe('H2')

    rerender(<BannerShape preset="strip" heading="Small notice" />)
    expect(screen.getByText('Small notice').tagName).toBe('DIV')
  })

  it('neutralizes link navigation when interactive={false}', () => {
    const { container } = render(
      <BannerShape preset="strip" heading="Hi" linkLabel="Go" linkUrl="https://x.test" interactive={false} />
    )
    expect(container.querySelector('a[href="https://x.test"]')).not.toBeInTheDocument()
    expect(screen.getByText('Go')).toBeInTheDocument()
    expect(screen.getByText('Go').tagName).toBe('SPAN')
  })
})
