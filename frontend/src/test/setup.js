import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom doesn't implement scrolling or ResizeObserver.
window.scrollTo = vi.fn()
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.scrollTo = vi.fn()
Element.prototype.scrollBy = vi.fn()

globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback
  }

  observe() {
    this.callback([])
  }

  disconnect() {}
}

afterEach(() => {
  cleanup()
  localStorage.clear()
})
