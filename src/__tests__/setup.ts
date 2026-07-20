import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// @testing-library/dom's waitFor only recognizes fake timers when a global
// `jest` object is present (it checks `jest.isMockFunction`-style markers on
// setTimeout). Alias it to vitest's `vi` so waitFor() correctly advances
// under vi.useFakeTimers() instead of deadlocking against real timers.
if (typeof (globalThis as { jest?: unknown }).jest === 'undefined') {
  ;(globalThis as { jest?: unknown }).jest = vi
}

// Mock scrollIntoView for testing
Element.prototype.scrollIntoView = vi.fn()
