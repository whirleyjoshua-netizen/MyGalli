import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KollabReelRequest } from './KollabReelRequest'

const setup = (over: any = {}) => {
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  render(<KollabReelRequest onSubmit={onSubmit} onClose={onClose} busy={false} error={null} {...over} />)
  return { onSubmit, onClose }
}

describe('KollabReelRequest', () => {
  it('defaults to the recent preset and 30 seconds', () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByRole('button', { name: /make it/i }))
    expect(onSubmit).toHaveBeenCalledWith({ preset: 'recent', prompt: null, targetSec: 30 })
  })

  it('submits the chosen preset', () => {
    const { onSubmit } = setup()
    fireEvent.click(screen.getByLabelText(/best of the pool/i))
    fireEvent.click(screen.getByRole('button', { name: /make it/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ preset: 'best' }))
  })

  it('submits a trimmed prompt', () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByPlaceholderText(/describe it/i), { target: { value: '  the goals  ' } })
    fireEvent.click(screen.getByRole('button', { name: /make it/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ prompt: 'the goals' }))
  })

  it('sends null for a blank prompt', () => {
    const { onSubmit } = setup()
    fireEvent.change(screen.getByPlaceholderText(/describe it/i), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /make it/i }))
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ prompt: null }))
  })

  it('caps the prompt at 200 characters', () => {
    setup()
    const box = screen.getByPlaceholderText(/describe it/i) as HTMLTextAreaElement
    expect(box.maxLength).toBe(200)
  })

  it('disables the submit button while busy', () => {
    setup({ busy: true })
    expect(screen.getByRole('button', { name: /making/i })).toBeDisabled()
  })

  it('shows an error', () => {
    setup({ error: 'Not enough in the pool' })
    expect(screen.getByText('Not enough in the pool')).toBeInTheDocument()
  })

  it('closes on Escape', () => {
    const { onClose } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})
