import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HubPrivacyControl } from './HubPrivacyControl'

describe('HubPrivacyControl', () => {
  it('non-Pro owner sees the upgrade prompt instead of applying', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(<HubPrivacyControl visibility="public" isPro={false} onApply={onApply} />)

    fireEvent.click(screen.getByLabelText('Privacy settings'))
    fireEvent.click(screen.getByText('Private'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument())
    expect(onApply).not.toHaveBeenCalled()
  })

  it('Pro owner applies private + passcode', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(<HubPrivacyControl visibility="public" isPro onApply={onApply} />)

    fireEvent.click(screen.getByLabelText('Privacy settings'))
    fireEvent.click(screen.getByText('Private'))
    fireEvent.change(screen.getByPlaceholderText('Set passcode (optional)'), {
      target: { value: 'secret' },
    })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith({ visibility: 'private', passcode: 'secret' })
    )
  })

  it('Pro owner switching to public clears the passcode', async () => {
    const onApply = vi.fn().mockResolvedValue(undefined)
    render(<HubPrivacyControl visibility="private" hasPasscode isPro onApply={onApply} />)

    fireEvent.click(screen.getByLabelText('Privacy settings'))
    fireEvent.click(screen.getByText('Public'))
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith({ visibility: 'public', passcode: null })
    )
  })
})
