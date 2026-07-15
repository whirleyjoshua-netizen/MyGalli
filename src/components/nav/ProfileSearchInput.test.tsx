import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProfileSearchInput } from './ProfileSearchInput'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => vi.clearAllMocks())

describe('ProfileSearchInput', () => {
  it('routes to explore with the query on submit', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surfing' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/explore?search=surfing')
  })

  it('encodes special characters in the query', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'surf & turf' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/explore?search=surf%20%26%20turf')
  })

  it('trims surrounding whitespace from the query', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '  surfing  ' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).toHaveBeenCalledWith('/explore?search=surfing')
  })

  it('does nothing when submitted empty', () => {
    render(<ProfileSearchInput />)
    fireEvent.submit(screen.getByRole('search'))
    expect(push).not.toHaveBeenCalled()
  })

  it('does nothing when submitted with only whitespace', () => {
    render(<ProfileSearchInput />)
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '   ' } })
    fireEvent.submit(screen.getByRole('search'))
    expect(push).not.toHaveBeenCalled()
  })
})
