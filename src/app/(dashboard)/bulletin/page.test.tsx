import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BulletinPage from './page'

vi.mock('@/components/bulletin/BulletinTab', () => ({
  BulletinTab: () => <div data-testid="bulletin-tab" />,
}))

describe('BulletinPage', () => {
  it('renders the Bulletin heading and the BulletinTab', () => {
    render(<BulletinPage />)
    expect(screen.getByRole('heading', { name: /bulletin/i })).toBeTruthy()
    expect(screen.getByTestId('bulletin-tab')).toBeTruthy()
  })
})
