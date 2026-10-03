// App: the router serves pages by address, wrapped in the real AuthProvider.

import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import App from './App'

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false })
})

test('the home page is served at /', () => {
  window.history.pushState({}, '', '/')
  render(<App />)

  expect(screen.getByRole('heading', { level: 1, name: /best product/ })).toBeInTheDocument()
})

test('the sign-in page is served at /login', () => {
  window.history.pushState({}, '', '/login')
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
})

test('the product page without a product says so', () => {
  window.history.pushState({}, '', '/product')
  render(<App />)

  expect(screen.getByRole('heading', { name: 'No product selected' })).toBeInTheDocument()
})
