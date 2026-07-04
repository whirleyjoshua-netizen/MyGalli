import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorActionsMenu } from './EditorActionsMenu'

const base = {
  saving: false,
  lastSaved: null,
  onPreview: vi.fn(),
}

function open() {
  fireEvent.click(screen.getByLabelText('More actions'))
}

describe('EditorActionsMenu', () => {
  it('is closed by default and opens on kebab click', () => {
    render(<EditorActionsMenu {...base} />)
    expect(screen.queryByRole('menu')).toBeNull()
    open()
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('shows Saved when lastSaved is set, Saving… while saving', () => {
    const { rerender } = render(<EditorActionsMenu {...base} lastSaved={new Date(0)} />)
    open()
    expect(screen.getByText('Saved')).toBeInTheDocument()
    rerender(<EditorActionsMenu {...base} saving lastSaved={new Date(0)} />)
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('Preview calls onPreview and closes the menu', () => {
    const onPreview = vi.fn()
    render(<EditorActionsMenu {...base} onPreview={onPreview} />)
    open()
    fireEvent.click(screen.getByRole('menuitem', { name: /preview/i }))
    expect(onPreview).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('hides Share and Collaborate when their handlers are absent', () => {
    render(<EditorActionsMenu {...base} />)
    open()
    expect(screen.queryByRole('menuitem', { name: /share/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /collaborate/i })).toBeNull()
  })

  it('shows Share and Collaborate when handlers provided', () => {
    render(<EditorActionsMenu {...base} onShare={vi.fn()} onCollaborate={vi.fn()} />)
    open()
    expect(screen.getByRole('menuitem', { name: /share/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /collaborate/i })).toBeInTheDocument()
  })

  it('renders a View Live link to liveHref when provided', () => {
    render(<EditorActionsMenu {...base} liveHref="/josh/my-page" />)
    open()
    expect(screen.getByRole('menuitem', { name: /view live/i })).toHaveAttribute('href', '/josh/my-page')
  })
})
