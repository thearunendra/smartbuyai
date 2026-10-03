// Profile page: access, account details, recent chats and the wishlist.

import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import Profile from './Profile'
import { api } from '../api'
import { useAuth } from '../auth'

vi.mock('../api', () => ({ api: vi.fn() }))
vi.mock('../auth', () => ({ useAuth: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => <nav aria-label="Navbar" /> }))

const user = { name: 'Asha Verma', email: 'asha@example.com', createdAt: '2026-01-15T10:00:00Z' }

const chats = Array.from({ length: 6 }, (_, index) => ({
  id: `c${index}`,
  title: `Chat ${index}`,
  updatedAt: new Date(2026, 9, 3, 11 - index)
}))

const wishlist = [
  {
    id: 'w1',
    name: 'Apple iPhone 15',
    product: { name: 'Apple iPhone 15', price: 58990, store: 'Croma', image: 'https://img.example/i.jpg' }
  },
  { id: 'w2', name: 'Plain Kettle', product: { name: 'Plain Kettle', price: 999, store: 'Amazon' } }
]

let signOut

function Where() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function mockApi({ chatList = chats, items = wishlist, fail = false } = {}) {
  api.mockImplementation(async (path, options = {}) => {
    if (fail) throw new Error('down')
    if (path === '/api/chats') return { chats: chatList }
    if (path === '/api/wishlist') return { items }
    if (options.method === 'DELETE') return null
    throw new Error(`Unexpected ${path}`)
  })
}

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 9, 3, 12, 0))
  api.mockReset()
  signOut = vi.fn()
  useAuth.mockReturnValue({ user, checking: false, signOut })
})

afterEach(() => {
  vi.useRealTimers()
})

test('waits while the sign-in is checked', () => {
  useAuth.mockReturnValue({ user: null, checking: true, signOut })
  renderProfile()

  expect(screen.getByLabelText('Navbar')).toBeInTheDocument()
  expect(api).not.toHaveBeenCalled()
})

test('guests are sent to sign in', () => {
  useAuth.mockReturnValue({ user: null, checking: false, signOut })
  renderProfile()

  expect(screen.getByTestId('path')).toHaveTextContent('/login?next=/profile')
})

test('shows the account, chat count and the 5 newest chats', async () => {
  mockApi()
  renderProfile()

  expect(screen.getByRole('heading', { name: 'Asha Verma' })).toBeInTheDocument()
  expect(screen.getByText('asha@example.com')).toBeInTheDocument()
  expect(screen.getByText('January 2026')).toBeInTheDocument()

  expect(await screen.findByText('6')).toBeInTheDocument()

  const recent = screen.getByRole('heading', { name: 'Recent chats' }).closest('section')

  expect(within(recent).getAllByRole('link', { name: /Chat \d/ })).toHaveLength(5)
  expect(within(recent).getByRole('link', { name: /Chat 0/ })).toHaveAttribute('href', '/chatbot/c0')
  expect(within(recent).getByRole('link', { name: /Open assistant/ })).toBeInTheDocument()
})

test('shows the wishlist with links to the details page', async () => {
  mockApi()
  renderProfile()

  const link = await screen.findByRole('link', { name: /Apple iPhone 15/ })

  expect(link).toHaveAttribute('href', '/product?name=Apple%20iPhone%2015')
  expect(link).toHaveTextContent('₹58,990at Croma')
  // Decorative images (alt="") have no img role, so query the element.
  expect(link.querySelector('img')).toHaveAttribute('src', 'https://img.example/i.jpg')
  // Without an image, a placeholder icon is shown.
  expect(screen.getByRole('link', { name: /Plain Kettle/ }).querySelector('img')).toBeNull()
})

test('removing a product calls the API and drops it from the list', async () => {
  mockApi()
  renderProfile()

  fireEvent.click(await screen.findByRole('button', { name: 'Remove Apple iPhone 15 from wishlist' }))

  // The item leaves the list once the request finishes.
  await vi.waitFor(() =>
    expect(screen.queryByRole('link', { name: /Apple iPhone 15/ })).not.toBeInTheDocument()
  )
  expect(screen.getByRole('link', { name: /Plain Kettle/ })).toBeInTheDocument()
  expect(api).toHaveBeenCalledWith('/api/wishlist?name=Apple%20iPhone%2015', { method: 'DELETE' })
})

test('a failed removal is logged and the item still leaves the list', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  mockApi()
  renderProfile()

  const remove = await screen.findByRole('button', { name: 'Remove Plain Kettle from wishlist' })

  api.mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(remove)

  await vi.waitFor(() => expect(screen.queryByRole('link', { name: /Plain Kettle/ })).toBeNull())
  expect(console.error).toHaveBeenCalled()
})

test('empty lists explain what will appear', async () => {
  mockApi({ chatList: [], items: [] })
  renderProfile()

  expect(await screen.findByText(/No chats yet/)).toBeInTheDocument()
  expect(await screen.findByText(/No saved products yet/)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /Open assistant/ })).not.toBeInTheDocument()
})

test('load errors show empty lists', async () => {
  mockApi({ fail: true })
  renderProfile()

  expect(await screen.findByText(/No chats yet/)).toBeInTheDocument()
  expect(await screen.findByText(/No saved products yet/)).toBeInTheDocument()
})

test('Sign out signs out and goes to the sign-in page', async () => {
  mockApi()
  renderProfile()

  fireEvent.click(screen.getByRole('button', { name: /Sign out/ }))

  expect(signOut).toHaveBeenCalled()
  expect(screen.getByTestId('path')).toHaveTextContent('/login')
})

test('a user without a name gets "U"', () => {
  mockApi()
  useAuth.mockReturnValue({ user: { ...user, name: '' }, checking: false, signOut })
  renderProfile()

  expect(screen.getByText('U')).toBeInTheDocument()
})
