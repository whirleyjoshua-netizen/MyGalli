import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerInspector } from './BannerInspector'
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

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<BannerInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('BannerInspector', () => {
  it('changes preset → bannerPreset', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/style/i), { target: { value: 'hero' } })
    expect(onChange).toHaveBeenCalledWith({ bannerPreset: 'hero' })
  })

  it('changes heading → bannerHeading', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/heading/i), { target: { value: 'Sale' } })
    expect(onChange).toHaveBeenCalledWith({ bannerHeading: 'Sale' })
  })

  it('changes subtext → bannerSubtext', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/subtext/i), { target: { value: 'Ends Friday' } })
    expect(onChange).toHaveBeenCalledWith({ bannerSubtext: 'Ends Friday' })
  })

  it('changes link label and url → bannerLinkLabel / bannerLinkUrl', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/button label/i), { target: { value: 'Book' } })
    expect(onChange).toHaveBeenCalledWith({ bannerLinkLabel: 'Book' })
    fireEvent.change(screen.getByLabelText(/button link/i), { target: { value: 'https://x.test' } })
    expect(onChange).toHaveBeenCalledWith({ bannerLinkUrl: 'https://x.test' })
  })

  it('switching fill kind clears the stale fill value', () => {
    const onChange = setup({ bannerFillKind: 'token', bannerFillValue: 'primary' })
    fireEvent.change(screen.getByLabelText(/fill type/i), { target: { value: 'gradient' } })
    expect(onChange).toHaveBeenCalledWith({ bannerFillKind: 'gradient', bannerFillValue: 'mint-aqua' })
  })

  it('switching to image fill clears the value entirely', () => {
    const onChange = setup({ bannerFillKind: 'gradient', bannerFillValue: 'mint-aqua' })
    fireEvent.change(screen.getByLabelText(/fill type/i), { target: { value: 'image' } })
    expect(onChange).toHaveBeenCalledWith({ bannerFillKind: 'image', bannerFillValue: '' })
  })

  it('offers gradient names when the fill kind is gradient', () => {
    setup({ bannerFillKind: 'gradient', bannerFillValue: 'mint-aqua' })
    expect(screen.getByLabelText(/gradient/i)).toHaveValue('mint-aqua')
  })

  it('reflects the current preset', () => {
    setup({ bannerPreset: 'crest' })
    expect(screen.getByLabelText(/style/i)).toHaveValue('crest')
  })
})
