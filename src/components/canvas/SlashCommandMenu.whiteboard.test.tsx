import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlashCommandMenu } from './SlashCommandMenu'

describe('SlashCommandMenu whiteboard entry', () => {
  it('offers the Whiteboard command to everyone, with no Pro badge', () => {
    render(<SlashCommandMenu position={{ x: 0, y: 0 }} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Whiteboard')).toBeInTheDocument()
    // Whiteboard and Appointments were the only Pro-gated commands; both are
    // now free, so no Pro badge should render anywhere in the menu.
    expect(screen.queryAllByText('Pro')).toHaveLength(0)
  })

  it('offers the Appointments command to everyone', () => {
    render(<SlashCommandMenu position={{ x: 0, y: 0 }} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Appointments')).toBeInTheDocument()
  })
})
