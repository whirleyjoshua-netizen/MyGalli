import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// Mock scrollIntoView for testing
Element.prototype.scrollIntoView = vi.fn()
