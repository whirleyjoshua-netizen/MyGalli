import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicFlowchartElement } from './PublicFlowchartElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(flowNodes: CanvasElement['flowNodes']): CanvasElement {
  return { id: 'el-1', type: 'flowchart', flowTitle: 'Flow', flowNodes } as CanvasElement
}

describe('PublicFlowchartElement', () => {
  it('renders a card per node and an arrow per child edge', () => {
    const { container } = render(<PublicFlowchartElement element={el([
      { id: 'a', title: 'Start' },
      { id: 'b', title: 'Next', parentId: 'a' },
    ])} />)
    expect(screen.getByText('Start')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
    expect(container.querySelectorAll('line').length).toBe(1) // one edge a->b
  })

  it('clicking a linked block shows detail with an Open link to its url', () => {
    render(<PublicFlowchartElement element={el([
      { id: 'a', title: 'Step', description: 'Do the thing', linkUrl: 'https://example.com', linkLabel: 'Example' },
    ])} />)
    fireEvent.click(screen.getByText('Step'))
    expect(screen.getByText('Do the thing')).toBeTruthy()
    const open = screen.getByRole('link', { name: /open/i }) as HTMLAnchorElement
    expect(open.getAttribute('href')).toBe('https://example.com')
    expect(open.getAttribute('target')).toBe('_blank')
    expect(open.getAttribute('rel')).toContain('noopener')
  })

  it('a block with no link shows detail but no Open link', () => {
    render(<PublicFlowchartElement element={el([{ id: 'a', title: 'Note', description: 'plain' }])} />)
    fireEvent.click(screen.getByText('Note'))
    expect(screen.getByText('plain')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  })

  it('drops an unsafe external url (javascript:) — no Open link', () => {
    render(<PublicFlowchartElement element={el([
      { id: 'a', title: 'Bad', linkUrl: 'javascript:alert(1)' },
    ])} />)
    fireEvent.click(screen.getByText('Bad'))
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  })

  it('empty flow renders a neutral placeholder', () => {
    render(<PublicFlowchartElement element={el([])} />)
    expect(screen.getByText(/no steps/i)).toBeTruthy()
  })
})
