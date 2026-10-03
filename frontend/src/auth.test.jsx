// AuthProvider: checking a saved token (valid, rejected, network error),
// sign in, register and sign out.

import { useEffect } from 'react'
import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { AuthProvider, useAuth } from './auth'
import { api, getToken, setToken } from './api'

vi.mock('./api', () => ({
  api: vi.fn(),
  getToken: vi.fn(),
  setToken: vi.fn()
}))

// The latest context value, for calling signIn etc. from the tests.
let auth

function Probe() {
  const value = useAuth()

  useEffect(() => {
    auth = value
  })

  return (
    <p>
      {value.checking ? 'checking' : 'ready'} / {value.user ? value.user.name : 'guest'}
    </p>
  )
}

function renderAuth() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

beforeEach(() => {
  vi.mocked(api).mockReset()
  vi.mocked(getToken).mockReset()
  vi.mocked(setToken).mockReset()
})

describe('saved token', () => {
  test('without a token there is nothing to check', () => {
    getToken.mockReturnValue(null)

    renderAuth()

    expect(screen.getByText('ready / guest')).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })

  test('a valid token signs the user in', async () => {
    getToken.mockReturnValue('tok')
    api.mockResolvedValue({ user: { name: 'Asha' } })

    renderAuth()

    expect(screen.getByText('checking / guest')).toBeInTheDocument()
    expect(await screen.findByText('ready / Asha')).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/api/auth/me')
  })

  test('a rejected token is removed', async () => {
    getToken.mockReturnValue('old')
    api.mockRejectedValue(Object.assign(new Error('Please sign in'), { status: 401 }))

    renderAuth()

    expect(await screen.findByText('ready / guest')).toBeInTheDocument()
    expect(setToken).toHaveBeenCalledWith(null)
  })

  test('a network error keeps the token', async () => {
    getToken.mockReturnValue('tok')
    api.mockRejectedValue(new Error('Failed to fetch'))

    renderAuth()

    expect(await screen.findByText('ready / guest')).toBeInTheDocument()
    expect(setToken).not.toHaveBeenCalled()
  })

  test('a reply after unmounting is ignored', async () => {
    let resolve

    getToken.mockReturnValue('tok')
    api.mockReturnValue(new Promise((done) => { resolve = done }))

    const { unmount } = renderAuth()

    unmount()
    await act(async () => resolve({ user: { name: 'Late' } }))

    expect(auth.user).toBeNull()
  })
})

describe('actions', () => {
  beforeEach(() => {
    getToken.mockReturnValue(null)
  })

  test('signIn saves the token and user', async () => {
    api.mockResolvedValue({ token: 't1', user: { name: 'Ravi' } })
    renderAuth()

    let returned

    await act(async () => {
      returned = await auth.signIn('ravi@example.com', 'secret123')
    })

    expect(api).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'ravi@example.com', password: 'secret123' }
    })
    expect(setToken).toHaveBeenCalledWith('t1')
    expect(returned).toEqual({ name: 'Ravi' })
    expect(screen.getByText('ready / Ravi')).toBeInTheDocument()
  })

  test('register saves the token and user', async () => {
    api.mockResolvedValue({ token: 't2', user: { name: 'New' } })
    renderAuth()

    await act(() => auth.register('New', 'new@example.com', 'secret123'))

    expect(api).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: { name: 'New', email: 'new@example.com', password: 'secret123' }
    })
    expect(setToken).toHaveBeenCalledWith('t2')
    expect(screen.getByText('ready / New')).toBeInTheDocument()
  })

  test('a failed sign-in throws and keeps the user signed out', async () => {
    api.mockRejectedValue(new Error('Invalid email or password.'))
    renderAuth()

    await expect(auth.signIn('a@b.co', 'x')).rejects.toThrow('Invalid email or password.')
    expect(setToken).not.toHaveBeenCalled()
  })

  test('signOut clears the token and user', async () => {
    api.mockResolvedValue({ token: 't1', user: { name: 'Ravi' } })
    renderAuth()

    await act(() => auth.signIn('a@b.co', 'secret123'))
    act(() => auth.signOut())

    expect(setToken).toHaveBeenLastCalledWith(null)
    expect(screen.getByText('ready / guest')).toBeInTheDocument()
  })
})
