import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerElement } from './BannerElement'
import { PublicBanner } from './PublicBanner'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'b1', type: 'banner',
  bannerPreset: 'ribbon',
  bannerHeading: 'Your headline',
  bannerSubtext: '',
  bannerFillKind: 'token',
  bannerFillValue: 'primary',
  bannerLinkLabel: '',
  bannerLinkUrl: '',
  ...over,
} as CanvasElement)

describe('PublicBanner', () => {
  it('renders the heading read-only', () => {
    render(<PublicBanner element={el({ bannerHeading: 'Grand Opening' })} />)
    expect(screen.getByText('Grand Opening')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('BannerElement', () => {
  it('edits the heading inline → bannerHeading', () => {
    const onChange = vi.fn()
    render(
      <BannerElement element={el()} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/banner heading/i), { target: { value: 'Now booking' } })
    expect(onChange).toHaveBeenCalledWith({ bannerHeading: 'Now booking' })
  })

  it('edits the subtext inline → bannerSubtext', () => {
    const onChange = vi.fn()
    render(
      <BannerElement element={el()} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/banner subtext/i), { target: { value: 'Spring 2026' } })
    expect(onChange).toHaveBeenCalledWith({ bannerSubtext: 'Spring 2026' })
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(
      <BannerElement element={el()} onChange={vi.fn()} onDelete={vi.fn()} isSelected={false} onSelect={onSelect} />
    )
    fireEvent.click(screen.getByTestId('banner-editor'))
    expect(onSelect).toHaveBeenCalled()
  })

  it('unselected banner with empty subtext renders NO subtext input', () => {
    render(
      <BannerElement element={el({ bannerSubtext: '' })} onChange={vi.fn()} onDelete={vi.fn()} isSelected={false} onSelect={vi.fn()} />
    )
    expect(screen.queryByLabelText(/banner subtext/i)).not.toBeInTheDocument()
  })

  it('selected banner with empty subtext renders subtext input', () => {
    render(
      <BannerElement element={el({ bannerSubtext: '' })} onChange={vi.fn()} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    expect(screen.getByLabelText(/banner subtext/i)).toBeInTheDocument()
  })

  it('heading alignment matches preset: left for pennant/notice, centered for others', () => {
    const { rerender } = render(
      <BannerElement element={el({ bannerPreset: 'pennant' })} onChange={vi.fn()} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    const pennantInput = screen.getByLabelText(/banner heading/i) as HTMLInputElement
    expect(pennantInput.style.textAlign).toBe('left')

    rerender(
      <BannerElement element={el({ bannerPreset: 'notice' })} onChange={vi.fn()} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    const noticeInput = screen.getByLabelText(/banner heading/i) as HTMLInputElement
    expect(noticeInput.style.textAlign).toBe('left')

    rerender(
      <BannerElement element={el({ bannerPreset: 'ribbon' })} onChange={vi.fn()} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    const ribbonInput = screen.getByLabelText(/banner heading/i) as HTMLInputElement
    expect(ribbonInput.style.textAlign).toBe('center')

    rerender(
      <BannerElement element={el({ bannerPreset: 'hero' })} onChange={vi.fn()} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    const heroInput = screen.getByLabelText(/banner heading/i) as HTMLInputElement
    expect(heroInput.style.textAlign).toBe('center')
  })

  it('editor does not render navigable link when linkLabel and linkUrl are set', () => {
    const { container } = render(
      <BannerElement
        element={el({ bannerLinkLabel: 'Click me', bannerLinkUrl: 'https://example.com' })}
        onChange={vi.fn()}
        onDelete={vi.fn()}
        isSelected
        onSelect={vi.fn()}
      />
    )
    expect(container.querySelector('a[href="https://example.com"]')).not.toBeInTheDocument()
    expect(screen.getByText('Click me')).toBeInTheDocument()
    expect(screen.getByText('Click me').tagName).toBe('SPAN')
  })
})
