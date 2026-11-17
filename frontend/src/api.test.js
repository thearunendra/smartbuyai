// api(): token header, JSON body, 204, errors with and without a message;
// token storage including blocked localStorage.

import { beforeEach, describe, expect, test, vi } from 'vitest'
import { api, getToken, setToken } from './api'
import { API_URL } from './config'

function reply(status, body, { json = true } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: json ? async () => body : async () => { throw new SyntaxError('not json') }
  }
}

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('token storage', () => {
  test('saves, reads and removes the token', () => {
    expect(getToken()).toBeNull()

    setToken('abc')
    expect(getToken()).toBe('abc')

    setToken(null)
    expect(getToken()).toBeNull()
  })

  test('blocked storage reads as no token and saving is ignored', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })

    expect(getToken()).toBeNull()
    expect(() => setToken('abc')).not.toThrow()
  })
})

describe('api', () => {
  test('a guest GET sends no headers or body', async () => {
    fetchMock.mockResolvedValue(reply(200, { ok: true }))

    await expect(api('/api/health')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/health`, expect.objectContaining({
      method: 'GET',
      headers: {},
      body: undefined,
      signal: expect.any(AbortSignal)
    }))
  })

  test('sends the token and a JSON body', async () => {
    setToken('tok')
    fetchMock.mockResolvedValue(reply(201, { id: 1 }))

    await api('/api/wishlist', { method: 'POST', body: { a: 1 } })

    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/api/wishlist`, expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: '{"a":1}',
      signal: expect.any(AbortSignal)
    }))
  })

  test('204 returns null', async () => {
    fetchMock.mockResolvedValue(reply(204, null))

    await expect(api('/api/chats/1', { method: 'DELETE' })).resolves.toBeNull()
  })

  test("errors carry the server's message and status", async () => {
    fetchMock.mockResolvedValue(reply(409, { message: 'Already registered.' }))

    await expect(api('/api/auth/register')).rejects.toMatchObject({
      message: 'Already registered.',
      status: 409
    })
  })

  test('errors without a JSON message get a general one', async () => {
    fetchMock.mockResolvedValue(reply(502, null, { json: false }))

    await expect(api('/api/search')).rejects.toMatchObject({
      message: 'Something went wrong.',
      status: 502
    })
  })

  test('a successful reply that is not JSON gives an empty object', async () => {
    fetchMock.mockResolvedValue(reply(200, null, { json: false }))

    await expect(api('/api/x')).resolves.toEqual({})
  })

  test('aborts a request that exceeds its timeout', async () => {
    vi.useFakeTimers()
    fetchMock.mockImplementation((_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    )

    const pending = api('/api/search', { timeoutMs: 50 })
    const rejectionAssertion = expect(pending).rejects.toMatchObject({
      name: 'TimeoutError',
      message: 'The request timed out. Please try again.'
    })

    await vi.advanceTimersByTimeAsync(50)
    await rejectionAssertion
    vi.useRealTimers()
  })
})
