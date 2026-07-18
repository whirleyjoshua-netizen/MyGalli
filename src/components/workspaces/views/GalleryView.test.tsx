import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GalleryView } from './GalleryView'

const fields = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text', position: 0 },
  { id: 'f2', key: 'fee', label: 'Fee', type: 'currency', position: 1, config: { symbol: '$' } },
] as any
const records = [{ id: 'r1', data: { name: 'Jordan', fee: 1200 }, updatedAt: '' }] as any

describe('GalleryView', () => {
  it('renders a card with the title + formatted field', () => {
    render(<GalleryView fields={fields} records={records} config={{ titleField: 'name' }} />)
    expect(screen.getByText('Jordan')).toBeInTheDocument()
    expect(screen.getByText('$1,200')).toBeInTheDocument()
  })
})
