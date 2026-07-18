import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock papaparse: parse() immediately calls opts.complete with our sample.
vi.mock('papaparse', () => ({
  default: {
    parse: (_file: any, opts: any) =>
      opts.complete({ meta: { fields: ['Name', 'GPA'] }, data: [{ Name: 'Ava', GPA: '3.8' }, { Name: 'B', GPA: 'x' }] }),
  },
}))

import { ImportCsvModal } from './ImportCsvModal'

const fields = [
  { id: 'f1', key: 'name', label: 'Name', type: 'text', position: 0 },
  { id: 'f2', key: 'gpa', label: 'GPA', type: 'number', position: 1 },
] as any

function pickFile() {
  const input = document.querySelector('input[type=file]') as HTMLInputElement
  const file = new File(['Name,GPA\nAva,3.8\nB,x'], 'students.csv', { type: 'text/csv' })
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => { vi.restoreAllMocks() })

describe('ImportCsvModal', () => {
  it('after parsing, auto-maps headers to fields', async () => {
    render(<ImportCsvModal workspaceId="w1" fields={fields} onClose={() => {}} onImported={() => {}} />)
    pickFile()
    await waitFor(() => expect(screen.getByLabelText('map-Name')).toHaveValue('name'))
    expect(screen.getByLabelText('map-GPA')).toHaveValue('gpa')
  })

  it('dry-run report renders valid/skipped counts from the endpoint', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true, json: async () => ({ validCount: 1, skippedCount: 1, errors: [{ row: 2, field: 'gpa', message: 'not a number' }] }),
    } as any)
    render(<ImportCsvModal workspaceId="w1" fields={fields} onClose={() => {}} onImported={() => {}} />)
    pickFile()
    await waitFor(() => screen.getByLabelText('map-Name'))
    fireEvent.click(screen.getByRole('button', { name: /validate/i }))
    await waitFor(() => expect(screen.getByText(/1 valid/i)).toBeInTheDocument())
    expect(screen.getByText(/1 skipped/i)).toBeInTheDocument()
  })
})
