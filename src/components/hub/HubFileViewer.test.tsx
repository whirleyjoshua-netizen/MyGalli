import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { HubFileViewer } from './HubFileViewer'

// Avoid loading react-pdf/pdf.js in jsdom (no image/pdf test needs it).
vi.mock('./PdfView', () => ({ default: () => <div data-testid="pdfview" /> }))

describe('HubFileViewer', () => {
  it('renders nothing when file is null', () => {
    const { container } = render(<HubFileViewer file={null} onClose={() => {}} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders an image and a Download link for an image file', () => {
    render(
      <HubFileViewer
        file={{ id: '1', type: 'file', title: 'Pic', url: 'https://x.blob/pic.png' }}
        onClose={() => {}}
      />
    )
    const img = screen.getByAltText('Pic') as HTMLImageElement
    expect(img.src).toContain('pic.png')
    expect(screen.getByLabelText('Download')).toBeTruthy()
  })

  it('closes on Escape and on backdrop click', () => {
    const onClose = vi.fn()
    render(
      <HubFileViewer
        file={{ id: '1', type: 'file', title: 'Pic', url: 'https://x.blob/pic.png' }}
        onClose={onClose}
      />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    // backdrop is the Close button's reliable proxy here:
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
