import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHero } from './PageHero'
import { ImageIcon } from 'lucide-react'

describe('PageHero', () => {
  it('renders title, subtitle, and icon', () => {
    render(<PageHero icon={<ImageIcon data-testid="hero-icon" />} title="Gallery" subtitle="Your pages and boards." />)
    expect(screen.getByRole('heading', { name: /Gallery/ })).toBeInTheDocument()
    expect(screen.getByText('Your pages and boards.')).toBeInTheDocument()
    expect(screen.getByTestId('hero-icon')).toBeInTheDocument()
  })

  it('renders action, controls, and tabs slots when provided', () => {
    render(
      <PageHero
        icon={<span />} title="X"
        action={<button>New page</button>}
        controls={<button>Grid</button>}
        tabs={<button>Pages</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'New page' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Grid' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pages' })).toBeInTheDocument()
  })

  it('omits optional slots when not provided and has a decorative banner', () => {
    const { container } = render(<PageHero icon={<span />} title="Only Title" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    // decorative banner image present with empty alt
    const img = container.querySelector('img[alt=""]')
    expect(img).toBeTruthy()
  })
})
