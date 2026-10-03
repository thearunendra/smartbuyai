// Navbar: theme toggle (saved and system), signed-in states, admin link and
// the mobile menu.

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import Navbar from './Navbar'
import { useAuth } from '../auth'

vi.mock('../auth', () => ({ useAuth: vi.fn() }))

function systemDark(dark) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: dark })
}

function renderNavbar() {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  )
}

beforeEach(() => {
  delete document.documentElement.dataset.theme
  systemDark(false)
  useAuth.mockReturnValue({ user: null, checking: false })
})

test('guests see the sign-in button and no admin link', () => {
  renderNavbar()

  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  expect(screen.queryByRole('link', { name: /Admin/ })).not.toBeInTheDocument()
})

test('shows a placeholder while the sign-in is checked', () => {
  useAuth.mockReturnValue({ user: null, checking: true })
  const { container } = renderNavbar()

  expect(container.querySelector('.nav-avatar-loading')).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
})

test('signed-in users see their initial and first name', () => {
  useAuth.mockReturnValue({ user: { name: 'asha verma', role: 'user' }, checking: false })
  renderNavbar()

  const profile = screen.getByRole('link', { name: /asha/ })

  expect(profile).toHaveAttribute('href', '/profile')
  expect(profile).toHaveTextContent('A')
})

test('a user without a name gets "U"', () => {
  useAuth.mockReturnValue({ user: { role: 'user' }, checking: false })
  renderNavbar()

  expect(screen.getByText('U')).toBeInTheDocument()
})

test('admins see the admin link', () => {
  useAuth.mockReturnValue({ user: { name: 'Root', role: 'admin' }, checking: false })
  renderNavbar()

  expect(screen.getByRole('link', { name: /Admin/ })).toHaveAttribute('href', '/admin')
})

test('switches between light and dark and saves the choice', () => {
  renderNavbar()

  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))

  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(localStorage.getItem('smartbuyTheme')).toBe('dark')

  fireEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
  expect(document.documentElement.dataset.theme).toBe('light')
})

test('starts from the saved theme, else the system setting', () => {
  document.documentElement.dataset.theme = 'dark'
  const { unmount } = renderNavbar()

  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  unmount()

  delete document.documentElement.dataset.theme
  systemDark(true)
  renderNavbar()

  expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
})

test('the theme still changes when storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked')
  })
  renderNavbar()

  fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))

  expect(document.documentElement.dataset.theme).toBe('dark')
})

test('the menu button opens and closes the menu', () => {
  const { container } = renderNavbar()
  const toggle = screen.getByRole('button', { name: 'Toggle menu' })

  fireEvent.click(toggle)
  expect(container.querySelector('.nav-links')).toHaveClass('open')

  fireEvent.click(screen.getByRole('link', { name: /Products/ }))
  expect(container.querySelector('.nav-links')).not.toHaveClass('open')
})
