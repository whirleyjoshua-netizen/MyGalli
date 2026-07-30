import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LayoutSectionsSection } from './LayoutSectionsSection'
import { DEFAULT_HUB_CONFIG } from '@/lib/types/hub-config'

describe('LayoutSectionsSection — who can make reels', () => {
  it('shows a select for whoCanStitch alongside whoCanDrop', () => {
    render(<LayoutSectionsSection config={DEFAULT_HUB_CONFIG} onChange={() => {}} hubId="h1" />)
    expect(screen.getByText('Who can make reels')).toBeInTheDocument()
  })

  it('reflects the current whoCanStitch value', () => {
    const config = { ...DEFAULT_HUB_CONFIG, kollab: { ...DEFAULT_HUB_CONFIG.kollab, whoCanStitch: 'owner-only' as const } }
    render(<LayoutSectionsSection config={config} onChange={() => {}} hubId="h1" />)
    expect(screen.getByLabelText('Who can make reels')).toHaveValue('owner-only')
  })

  it('writes whoCanStitch through onChange, leaving the rest of the config intact', () => {
    const onChange = vi.fn()
    render(<LayoutSectionsSection config={DEFAULT_HUB_CONFIG} onChange={onChange} hubId="h1" />)
    fireEvent.change(screen.getByLabelText('Who can make reels'), { target: { value: 'owner-only' } })
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0]
    expect(next.kollab.whoCanStitch).toBe('owner-only')
    expect(next.kollab.whoCanDrop).toBe(DEFAULT_HUB_CONFIG.kollab.whoCanDrop)
  })
})
