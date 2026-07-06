import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlashCommandMenu } from './SlashCommandMenu'

describe('SlashCommandMenu whiteboard entry', () => {
  it('shows the Whiteboard command with a Pro badge', () => {
    render(<SlashCommandMenu position={{ x: 0, y: 0 }} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Whiteboard')).toBeInTheDocument()
    // Pro badge rendered somewhere in the menu
    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0)
  })
})
