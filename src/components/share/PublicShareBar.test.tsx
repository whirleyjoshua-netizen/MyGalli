import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicShareBar } from './PublicShareBar'
import { trackShare } from '@/lib/analytics'

vi.mock('@/lib/analytics', () => ({
  trackShare: vi.fn(),
}))

describe('PublicShareBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a share toggle and reveals share controls when opened', () => {
    render(<PublicShareBar url="https://galli.page/joshua/my-page" title="My Page" displayId="disp-1" />)
    fireEvent.click(screen.getByText('Share this page'))
    expect(screen.getByLabelText('Share on X')).toBeTruthy()
    expect(screen.getByLabelText('Share on Facebook')).toBeTruthy()
    expect(screen.getByLabelText('Share on LinkedIn')).toBeTruthy()
  })

  it('calls trackShare with the displayId and channel when a share control is clicked', () => {
    render(<PublicShareBar url="https://galli.page/joshua/my-page" title="My Page" displayId="disp-1" />)
    fireEvent.click(screen.getByText('Share this page'))
    fireEvent.click(screen.getByLabelText('Share on X'))
    expect(trackShare).toHaveBeenCalledWith('disp-1', 'twitter')
  })

  it('does not track shares when displayId is empty', () => {
    render(<PublicShareBar url="https://galli.page/joshua/my-page" title="My Page" displayId="" />)
    fireEvent.click(screen.getByText('Share this page'))
    fireEvent.click(screen.getByLabelText('Share on X'))
    expect(trackShare).toHaveBeenCalledWith('', 'twitter')
  })
})
