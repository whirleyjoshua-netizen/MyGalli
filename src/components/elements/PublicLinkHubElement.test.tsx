import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicLinkHubElement } from './PublicLinkHubElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'link-hub', ...over })

describe('PublicLinkHubElement', () => {
  it('renders each item with a safe href opening in a new tab', () => {
    render(<PublicLinkHubElement element={el({ linkHubTitle: 'Find me', linkHubItems: [
      { label: 'Insta', url: 'https://instagram.com/x', icon: 'instagram' },
    ] })} />)
    const link = screen.getByRole('link', { name: /insta/i })
    expect(link).toHaveAttribute('href', 'https://instagram.com/x')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
  it('skips items with empty or unsafe urls', () => {
    render(<PublicLinkHubElement element={el({ linkHubItems: [
      { label: 'Empty', url: '' },
      { label: 'Bad', url: 'javascript:alert(1)' },
      { label: 'Good', url: 'https://a.com' },
    ] })} />)
    expect(screen.queryByText('Empty')).toBeNull()
    expect(screen.queryByText('Bad')).toBeNull()
    expect(screen.getByText('Good')).toBeInTheDocument()
  })
})
