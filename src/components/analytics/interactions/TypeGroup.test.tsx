import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TypeGroup } from './TypeGroup'

describe('TypeGroup', () => {
  it('renders the label, count and children', () => {
    render(
      <TypeGroup label="Polls" count={3}>
        <p>card</p>
      </TypeGroup>
    )
    expect(screen.getByText('Polls')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('card')).toBeTruthy()
  })

  it('collapses and expands on click', () => {
    render(
      <TypeGroup label="Polls" count={1}>
        <p>card</p>
      </TypeGroup>
    )
    fireEvent.click(screen.getByRole('button', { name: /polls/i }))
    expect(screen.queryByText('card')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /polls/i }))
    expect(screen.getByText('card')).toBeTruthy()
  })

  it('can start collapsed', () => {
    render(
      <TypeGroup label="Polls" count={1} defaultOpen={false}>
        <p>card</p>
      </TypeGroup>
    )
    expect(screen.queryByText('card')).toBeNull()
  })
})
