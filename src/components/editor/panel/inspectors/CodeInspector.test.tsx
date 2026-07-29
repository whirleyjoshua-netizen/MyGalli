import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CodeInspector } from './CodeInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'code',
  codeContent: 'console.log(1)',
  codeLanguage: 'javascript',
  codeTheme: 'dark',
  codeShowLineNumbers: true,
  codeFilename: '',
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<CodeInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('CodeInspector', () => {
  it('selects a language → codeLanguage', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/language/i), { target: { value: 'python' } })
    expect(onChange).toHaveBeenCalledWith({ codeLanguage: 'python' })
  })

  it('sets theme → codeTheme', () => {
    const onChange = setup()
    fireEvent.click(screen.getByRole('button', { name: /light/i }))
    expect(onChange).toHaveBeenCalledWith({ codeTheme: 'light' })
  })

  it('toggles line numbers → codeShowLineNumbers', () => {
    const onChange = setup()
    fireEvent.click(screen.getByLabelText(/line numbers/i))
    expect(onChange).toHaveBeenCalledWith({ codeShowLineNumbers: false })
  })

  it('edits filename → codeFilename', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/filename/i), { target: { value: 'app.tsx' } })
    expect(onChange).toHaveBeenCalledWith({ codeFilename: 'app.tsx' })
  })

  it('reflects the element state', () => {
    setup({ codeLanguage: 'rust', codeTheme: 'light', codeShowLineNumbers: false })
    expect(screen.getByLabelText(/language/i)).toHaveValue('rust')
    expect(screen.getByRole('button', { name: /light/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText(/line numbers/i)).not.toBeChecked()
  })

  it('leaves the code body to the card', () => {
    setup()
    expect(screen.getByText(/code itself is edited on the card/i)).toBeInTheDocument()
  })
})
