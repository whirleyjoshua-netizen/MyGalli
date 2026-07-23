import { vi, expect } from 'vitest'
import * as matchers from '@testing-library/jest-dom/matchers'

expect.extend(matchers)

// Mock scrollIntoView for testing
Element.prototype.scrollIntoView = vi.fn()
