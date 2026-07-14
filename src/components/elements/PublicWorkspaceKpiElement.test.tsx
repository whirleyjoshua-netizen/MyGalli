import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicWorkspaceKpiElement } from './PublicWorkspaceKpiElement'

const base: any = { id: 'e1', type: 'workspace-kpi', workspaceKpiFieldLabel: 'Grade', workspaceKpiAgg: 'avg' }

describe('PublicWorkspaceKpiElement', () => {
  it('renders value + default label + suffix', () => {
    render(<PublicWorkspaceKpiElement element={{ ...base, workspaceKpiValue: 3.74, workspaceKpiSuffix: ' GPA' }} />)
    expect(screen.getByText('3.74 GPA')).toBeInTheDocument()
    expect(screen.getByText(/Avg of Grade/i)).toBeInTheDocument()
  })
  it('renders an em-dash when value is null', () => {
    render(<PublicWorkspaceKpiElement element={{ ...base, workspaceKpiValue: null }} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
  it('uses a custom label when provided', () => {
    render(<PublicWorkspaceKpiElement element={{ ...base, workspaceKpiLabel: 'Class GPA', workspaceKpiValue: 3 }} />)
    expect(screen.getByText('Class GPA')).toBeInTheDocument()
  })
})
