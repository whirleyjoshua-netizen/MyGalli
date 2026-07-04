import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicTipJarElement } from './PublicTipJarElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'tip-jar', ...over })

describe('PublicTipJarElement', () => {
  it('renders a CTA linking to a safe url in a new tab', () => {
    render(<PublicTipJarElement element={el({ tipJarUrl: 'https://ko-fi.com/x', tipJarButtonText: 'Tip me' })} />)
    const link = screen.getByRole('link', { name: /tip me/i })
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/x')
    expect(link).toHaveAttribute('target', '_blank')
  })
  it('renders no actionable link when url is empty or unsafe', () => {
    render(<PublicTipJarElement element={el({ tipJarUrl: 'javascript:x', tipJarButtonText: 'Tip me' })} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('renders suggested amount chips', () => {
    render(<PublicTipJarElement element={el({ tipJarUrl: 'https://a.com', tipJarAmounts: ['$3', '$5'] })} />)
    expect(screen.getByText('$3')).toBeInTheDocument()
    expect(screen.getByText('$5')).toBeInTheDocument()
  })
})
