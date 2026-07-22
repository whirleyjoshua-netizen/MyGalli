import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderElement } from './render-elements'
import type { CanvasElement } from '@/lib/types/canvas'

vi.mock('@/lib/analytics', () => ({ trackInteraction: vi.fn().mockResolvedValue(undefined) }))

describe('renderElement — lead-gen', () => {
  it('renders the public lead-gen component with its headline', () => {
    const el = { id: 'lg1', type: 'lead-gen', leadGenHeadline: 'Grab it' } as CanvasElement
    render(<>{renderElement(el, 'd1')}</>)
    expect(screen.getByText('Grab it')).toBeTruthy()
    expect(screen.getByLabelText('Email')).toBeTruthy()
  })
})
