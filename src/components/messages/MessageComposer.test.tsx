import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageComposer } from './MessageComposer'
import { RequestBanner } from './RequestBanner'

describe('MessageComposer', () => {
  it('sends on click and clears the field', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    const box = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).toHaveBeenCalledWith('hello')
    expect(box.value).toBe('')
  })

  it('sends on Enter', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    const box = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.keyDown(box, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('inserts a newline on Shift+Enter instead of sending', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    const box = screen.getByPlaceholderText('Type a message...')
    fireEvent.change(box, { target: { value: 'hello' } })
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('refuses to send whitespace', () => {
    const onSend = vi.fn()
    render(<MessageComposer onSend={onSend} disabled={false} />)
    fireEvent.change(screen.getByPlaceholderText('Type a message...'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders the M3 attachment buttons disabled', () => {
    render(<MessageComposer onSend={() => {}} disabled={false} />)
    expect(screen.getByRole('button', { name: /attach/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /voice/i })).toBeDisabled()
  })

  it('disables the field entirely when disabled', () => {
    render(<MessageComposer onSend={() => {}} disabled />)
    expect(screen.getByPlaceholderText('Type a message...')).toBeDisabled()
  })
})

describe('RequestBanner', () => {
  it('offers Accept and Ignore', () => {
    const onAccept = vi.fn()
    const onIgnore = vi.fn()
    render(<RequestBanner name="Sarah" onAccept={onAccept} onIgnore={onIgnore} busy={false} />)
    expect(screen.getByText(/Sarah wants to message you/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /accept/i }))
    expect(onAccept).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /ignore/i }))
    expect(onIgnore).toHaveBeenCalled()
  })
})
