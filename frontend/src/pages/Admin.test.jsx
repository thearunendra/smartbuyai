// AdminLogin and the Admin dashboard: access checks, stats, empty and
// error states, refresh and sign out.

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Admin from './Admin'
import AdminLogin from './AdminLogin'
import { api } from '../api'
import { useAuth } from '../auth'

vi.mock('../api', () => ({ api: vi.fn() }))
vi.mock('../auth', () => ({ useAuth: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => <nav aria-label="Navbar" /> }))

function Where() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname}</p>
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<Admin />} />
        <Route path="/admin-login" element={<AdminLogin />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

let auth

beforeEach(() => {
  api.mockReset()
  auth = { user: null, checking: false, signIn: vi.fn(), signOut: vi.fn() }
  useAuth.mockImplementation(() => auth)
})

describe('AdminLogin', () => {
  function submit(email, password) {
    fireEvent.change(screen.getByLabelText('Admin email'), { target: { value: email } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as admin' }))
  }

  test('asks for both fields', () => {
    renderAt('/admin-login')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in as admin' }))

    expect(screen.getByText('Please fill all fields.')).toBeInTheDocument()
  })

  test('admins go to the dashboard', async () => {
    // Like the real signIn, this signs the user in.
    auth.signIn.mockImplementation(async () => {
      auth.user = { role: 'admin' }
      return auth.user
    })
    api.mockReturnValue(new Promise(() => {}))
    renderAt('/admin-login')
    submit(' root@example.com ', 'secret123')

    expect(await screen.findByRole('button', { name: /Refresh/ })).toBeInTheDocument()
    expect(auth.signIn).toHaveBeenCalledWith('root@example.com', 'secret123')
  })

  test('other accounts are signed out again', async () => {
    auth.signIn.mockResolvedValue({ role: 'user' })
    renderAt('/admin-login')
    submit('user@example.com', 'secret123')

    expect(await screen.findByText("This account doesn't have admin access.")).toBeInTheDocument()
    expect(auth.signOut).toHaveBeenCalled()
  })

  test('shows sign-in errors', async () => {
    auth.signIn.mockRejectedValue(new Error('Invalid email or password.'))
    renderAt('/admin-login')
    submit('root@example.com', 'wrong')

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
  })

  test('a signed-in admin skips the form', () => {
    auth.user = { role: 'admin' }
    api.mockReturnValue(new Promise(() => {}))
    renderAt('/admin-login')

    expect(screen.queryByLabelText('Admin email')).not.toBeInTheDocument()
  })

  test('the Customer tab goes to the customer sign-in', () => {
    renderAt('/admin-login')
    fireEvent.click(screen.getByRole('tab', { name: /Customer/ }))

    expect(screen.getByTestId('path')).toHaveTextContent('/login')
  })

  test('"Back to customer sign in" goes there too', () => {
    renderAt('/admin-login')
    fireEvent.click(screen.getByRole('button', { name: /Back to customer sign in/ }))

    expect(screen.getByTestId('path')).toHaveTextContent('/login')
  })
})

describe('Admin dashboard', () => {
  const stats = {
    totalSearches: 120,
    searchesLast7Days: 30,
    users: 12,
    chats: 40,
    wishlistItems: 17,
    mostSearched: { category: 'Smartphones', count: 50 },
    searchesPerDay: [
      { date: '2026-09-27', count: 2 },
      { date: '2026-10-03', count: 9 }
    ],
    categories: [
      { category: 'Smartphones', count: 50 },
      { category: 'Laptops', count: 20 }
    ],
    products: [{ product: 'iPhone 15', count: 7 }],
    zeroResultSearches: [{ query: 'flying car', category: 'Other', results: 0, time: '2026-10-03T06:30:00Z' }],
    recentSearches: [
      { query: 'phone under 20k', category: 'Smartphones', results: 6, time: '2026-10-03T06:30:00Z' },
      { query: 'odd', category: 'Other', time: null }
    ]
  }

  test('waits while the sign-in is checked', () => {
    auth.checking = true
    renderAt('/admin')

    expect(screen.getByLabelText('Navbar')).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })

  test('guests are sent to the admin sign-in', () => {
    renderAt('/admin')

    expect(screen.getByRole('heading', { name: 'Admin sign in' })).toBeInTheDocument()
  })

  test('non-admins are told and can switch account', () => {
    auth.user = { email: 'user@example.com', role: 'user' }
    renderAt('/admin')

    expect(screen.getByRole('heading', { name: 'Admin access required' })).toBeInTheDocument()
    expect(screen.getByText(/user@example.com/)).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in as admin' }))
    expect(auth.signOut).toHaveBeenCalled()
  })

  test('shows the statistics', async () => {
    auth.user = { role: 'admin' }
    api.mockResolvedValue(stats)
    renderAt('/admin')

    expect(await screen.findByText('120')).toBeInTheDocument()
    expect(screen.getByText('Wishlisted items')).toBeInTheDocument()
    expect(screen.getByText('17')).toBeInTheDocument()
    expect(screen.getAllByText('Smartphones').length).toBeGreaterThan(0)
    expect(screen.getByText('iPhone 15')).toBeInTheDocument()
    expect(screen.getByText('flying car')).toBeInTheDocument()
    expect(screen.getByText('phone under 20k')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
  })

  test('empty statistics say so', async () => {
    auth.user = { role: 'admin' }
    api.mockResolvedValue({})
    renderAt('/admin')

    expect(await screen.findByText('No searches yet.')).toBeInTheDocument()
    expect(screen.getByText('No product data yet.')).toBeInTheDocument()
    expect(screen.getByText('No recent searches.')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  test('shows load errors, and Refresh loads again', async () => {
    auth.user = { role: 'admin' }
    api.mockRejectedValueOnce(new Error('Server down')).mockRejectedValueOnce(new Error(''))
    renderAt('/admin')

    expect(await screen.findByText('Server down')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }))

    expect(await screen.findByText('Unable to load admin data.')).toBeInTheDocument()
    expect(api).toHaveBeenCalledTimes(2)
  })

  test('Sign out returns to the admin sign-in', async () => {
    auth.user = { role: 'admin' }
    api.mockResolvedValue(stats)
    renderAt('/admin')

    fireEvent.click(await screen.findByRole('button', { name: /Sign out/ }))

    expect(auth.signOut).toHaveBeenCalled()
  })
})
