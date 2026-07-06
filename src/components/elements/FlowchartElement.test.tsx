import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FlowchartElement } from './FlowchartElement'
import type { CanvasElement } from '@/lib/types/canvas'

vi.mock('@/lib/store', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { username: 'joe' } }) }))
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] })))
afterEach(() => vi.unstubAllGlobals())

function el(flowNodes: CanvasElement['flowNodes']): CanvasElement {
  return { id: 'el-1', type: 'flowchart', flowTitle: 'Flow', flowNodes } as CanvasElement
}
const noop = () => {}

describe('FlowchartElement', () => {
  it('the parent dropdown for a node excludes itself and its descendants', () => {
    // a -> b -> c ; editing a's parent must not offer a, b, or c
    const element = el([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', parentId: 'a' },
      { id: 'c', title: 'C', parentId: 'b' },
    ])
    render(<FlowchartElement element={element} onChange={noop} onDelete={noop} isSelected onSelect={noop} />)
    const selectA = screen.getByLabelText('parent-a') as HTMLSelectElement
    const optionValues = Array.from(selectA.options).map((o) => o.value)
    expect(optionValues).not.toContain('a')
    expect(optionValues).not.toContain('b')
    expect(optionValues).not.toContain('c')
    expect(optionValues).toContain('') // the "root" option
  })

  it('Add block appends a node via onChange', () => {
    const onChange = vi.fn()
    render(<FlowchartElement element={el([{ id: 'a', title: 'A' }])} onChange={onChange} onDelete={noop} isSelected onSelect={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /add block/i }))
    expect(onChange).toHaveBeenCalled()
    const arg = onChange.mock.calls[0][0]
    expect(arg.flowNodes).toHaveLength(2)
  })

  it('editing a block title updates that node', () => {
    const onChange = vi.fn()
    render(<FlowchartElement element={el([{ id: 'a', title: 'A' }])} onChange={onChange} onDelete={noop} isSelected onSelect={noop} />)
    const card = screen.getByTestId('flow-block-a')
    fireEvent.change(within(card).getByPlaceholderText(/title/i), { target: { value: 'Renamed' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      flowNodes: [expect.objectContaining({ id: 'a', title: 'Renamed' })],
    }))
  })

  it('deleting a node clears that id from its children’s parentId', () => {
    const onChange = vi.fn()
    render(<FlowchartElement element={el([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', parentId: 'a' },
    ])} onChange={onChange} onDelete={noop} isSelected onSelect={noop} />)
    fireEvent.click(screen.getByLabelText('delete-a'))
    const arg = onChange.mock.calls[0][0]
    expect(arg.flowNodes).toHaveLength(1)
    expect(arg.flowNodes[0].id).toBe('b')
    expect(arg.flowNodes[0].parentId).toBeUndefined()
  })
})
