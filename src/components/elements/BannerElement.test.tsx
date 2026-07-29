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
})
