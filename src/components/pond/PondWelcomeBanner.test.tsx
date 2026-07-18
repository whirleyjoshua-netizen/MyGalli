import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PondWelcomeBanner } from './PondWelcomeBanner'

it('shows welcome copy and fires onDismiss', () => {
  const onDismiss = vi.fn()
  render(<PondWelcomeBanner onDismiss={onDismiss} />)
  expect(screen.getByText(/welcome to your pond/i)).toBeInTheDocument()
  fireEvent.click(screen.getByLabelText(/dismiss/i))
  expect(onDismiss).toHaveBeenCalled()
})
