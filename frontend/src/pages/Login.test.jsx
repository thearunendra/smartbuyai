// Login page: validation, sign in, register, errors, the safe `next`
// redirect and switching modes.

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Login from './Login'
import { useAuth } from '../auth'

vi.mock('../auth', () => ({ useAuth: vi.fn() }))

let signIn
let register

function Where() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderLogin(url = '/login') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

function fill(fields) {
  for (const [label, value] of Object.entries(fields)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

beforeEach(() => {
  signIn = vi.fn().mockResolvedValue({})
  register = vi.fn().mockResolvedValue()
  useAuth.mockReturnValue({ user: null, signIn, register })
})

describe('sign in', () => {
  test('asks for every field', () => {
    renderLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByText('Please fill all fields.')).toBeInTheDocument()
    expect(signIn).not.toHaveBeenCalled()
  })

  test('signs in with a trimmed email and goes to the chatbot', async () => {
    renderLogin()
    fill({ Email: '  asha@example.com ', Password: 'secret123' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByTestId('path')).toHaveTextContent('/chatbot')
    expect(signIn).toHaveBeenCalledWith('asha@example.com', 'secret123')
  })

  test('returns to the page in `next`', async () => {
    renderLogin('/login?next=%2Fproduct%3Fname%3DPhone')
    fill({ Email: 'a@b.co', Password: 'secret123' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByTestId('path')).toHaveTextContent('/product?name=Phone')
    expect(screen.queryByText(/Sign in to chat/)).not.toBeInTheDocument()
  })

  test.each([['https://evil.example'], ['//evil.example']])(
    'ignores the outside address %s in `next`',
    async (next) => {
      renderLogin(`/login?next=${encodeURIComponent(next)}`)
      fill({ Email: 'a@b.co', Password: 'secret123' })
      fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

      expect(await screen.findByTestId('path')).toHaveTextContent('/chatbot')
    }
  )

  test('shows the server error and allows another try', async () => {
    signIn.mockRejectedValue(new Error('Invalid email or password.'))
    renderLogin()
    fill({ Email: 'a@b.co', Password: 'wrong-pass' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled()
  })

  test('shows "Please wait..." while signing in', () => {
    signIn.mockReturnValue(new Promise(() => {}))
    renderLogin()
    fill({ Email: 'a@b.co', Password: 'secret123' })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Please wait...' })).toBeDisabled()
  })

  test('a signed-in user is sent on at once', () => {
    useAuth.mockReturnValue({ user: { name: 'Asha' }, signIn, register })
    renderLogin('/login?next=/profile')

    expect(screen.getByTestId('path')).toHaveTextContent('/profile')
  })
})

describe('register', () => {
  function openRegister() {
    renderLogin('/login?next=/profile')
    fireEvent.click(screen.getByRole('button', { name: 'Create one' }))
  }

  test('switches to the sign-up form', () => {
    openRegister()

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByText('Save your chats and shop smarter with SmartBuy AI.')).toBeInTheDocument()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })

  test('needs a name', () => {
    openRegister()
    fill({ Email: 'a@b.co', Password: 'secret123' })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Please fill all fields.')).toBeInTheDocument()
  })

  test('needs a password of 8+ characters', () => {
    openRegister()
    fill({ 'Full name': 'Asha', Email: 'a@b.co', Password: 'short' })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
    expect(register).not.toHaveBeenCalled()
  })

  test('creates the account', async () => {
    openRegister()
    fill({ 'Full name': ' Asha ', Email: 'a@b.co', Password: 'secret123' })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByTestId('path')).toHaveTextContent('/profile')
    expect(register).toHaveBeenCalledWith('Asha', 'a@b.co', 'secret123')
  })

  test('switching back clears the message', () => {
    openRegister()
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.queryByText('Please fill all fields.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue to SmartBuy AI.')).toBeInTheDocument()
  })
})

test('the Admin tab opens the admin sign-in', () => {
  renderLogin()
  fireEvent.click(screen.getByRole('tab', { name: /Admin/ }))

  expect(screen.getByTestId('path')).toHaveTextContent('/admin-login')
})
