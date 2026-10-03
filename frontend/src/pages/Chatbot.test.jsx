// Chatbot page: access, asking (reply wording, errors, new chat URL), saved
// chats from the URL, questions from ?q=, and the history sidebar.

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Chatbot from './Chatbot'
import { api } from '../api'
import { useAuth } from '../auth'

vi.mock('../api', () => ({ api: vi.fn() }))
vi.mock('../auth', () => ({ useAuth: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => <nav aria-label="Navbar" /> }))

const product = { id: 'p1', name: 'Phone One', price: 15000, store: 'Amazon', offers: [] }

const savedChat = {
  title: 'Phones',
  messages: [
    { role: 'user', text: 'phone under 20k' },
    { role: 'ai', text: 'Here are two phones.', products: [product] },
    { role: 'ai', text: 'Search failed.', error: true }
  ]
}

let chatList
let searchReply

function mockApi() {
  api.mockImplementation(async (path, options = {}) => {
    if (path === '/api/chats') {
      if (chatList instanceof Error) throw chatList
      return { chats: chatList }
    }

    if (path === '/api/search') {
      if (searchReply instanceof Error) throw searchReply
      return typeof searchReply === 'function' ? searchReply(options.body) : searchReply
    }

    if (path.startsWith('/api/chats/') && options.method === 'DELETE') return null

    if (path === '/api/chats/c1') return savedChat
    if (path.startsWith('/api/chats/')) throw new Error('Chat not found.')

    throw new Error(`Unexpected ${path}`)
  })
}

function Where() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderChat(url = '/chatbot') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/chatbot" element={<><Chatbot /><Where /></>} />
        <Route path="/chatbot/:chatId" element={<><Chatbot /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

const input = () => screen.getByPlaceholderText(/Gaming laptop/)

function ask(text) {
  fireEvent.change(input(), { target: { value: text } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
}

beforeEach(() => {
  api.mockReset()
  useAuth.mockReturnValue({ user: { name: 'Asha' }, checking: false })
  chatList = [{ id: 'c1', title: 'Phones', updatedAt: new Date().toISOString() }]
  searchReply = {
    reply: 'Try these.',
    count: 1,
    results: [product],
    conversationId: 'new1'
  }
  mockApi()
})

describe('access', () => {
  test('waits while the sign-in is checked', () => {
    useAuth.mockReturnValue({ user: null, checking: true })
    renderChat()

    expect(screen.queryByPlaceholderText(/Gaming laptop/)).not.toBeInTheDocument()
  })

  test('guests are sent to sign in and back', () => {
    useAuth.mockReturnValue({ user: null, checking: false })
    renderChat('/chatbot?q=tv')

    expect(screen.getByTestId('path')).toHaveTextContent('/login?next=%2Fchatbot%3Fq%3Dtv')
  })
})

describe('asking', () => {
  test('shows the welcome screen and answers a suggestion', async () => {
    renderChat()

    expect(screen.getByRole('heading', { name: 'What are you shopping for?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Laptop under ₹60,000/ }))

    expect(screen.getByText('Laptop under ₹60,000 for coding')).toBeInTheDocument()
    expect(screen.getByText('Searching live listings...')).toBeInTheDocument()

    expect(await screen.findByText('Try these.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Phone One' })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/api/search', {
      method: 'POST',
      body: { query: 'Laptop under ₹60,000 for coding', conversationId: undefined }
    })

    // The new chat gets its own address.
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/chatbot/new1'))
  })

  test('the next question continues the same chat', async () => {
    renderChat()
    ask('first')
    await screen.findByText('Try these.')

    ask('second')
    await waitFor(() => expect(api).toHaveBeenCalledWith('/api/search', {
      method: 'POST',
      body: { query: 'second', conversationId: 'new1' }
    }))
  })

  test.each([
    [{ count: 2, results: [product, { ...product, id: 'p2', name: 'Phone Two' }] }, 'I found 2 products for you.'],
    [{ count: 1, results: [product] }, 'I found 1 product for you.'],
    [{ count: 0, results: [] }, "Sorry, I couldn't find a matching product."]
  ])('without a reply text: %o', async (reply, text) => {
    searchReply = reply
    renderChat()
    ask('tv')

    expect(await screen.findByText(text)).toBeInTheDocument()
  })

  test('errors appear as an error message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    searchReply = new Error("You're searching too fast.")
    renderChat()
    ask('tv')

    const bubble = await screen.findByText("You're searching too fast.")

    expect(bubble).toHaveClass('msg-error')
  })

  test('errors without a message get a general one', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    searchReply = new Error('')
    renderChat()
    ask('tv')

    expect(await screen.findByText('Unable to connect to SmartBuy AI.')).toBeInTheDocument()
  })

  test('blank questions are not sent and the input is locked while waiting', async () => {
    let finish

    searchReply = () => new Promise((done) => { finish = done })
    renderChat()

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    ask('tv')
    expect(input()).toBeDisabled()

    await act(async () => finish({ reply: 'Done.', count: 0, results: [] }))
    expect(input()).toBeEnabled()
  })

  test('a question from the Home page is asked once and removed from the URL', async () => {
    renderChat('/chatbot?q=ac%20under%2040k')

    expect(await screen.findByText('Try these.')).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith('/api/search', {
      method: 'POST',
      body: { query: 'ac under 40k', conversationId: undefined }
    })
    expect(api.mock.calls.filter(([path]) => path === '/api/search')).toHaveLength(1)
  })
})

describe('saved chats', () => {
  test('opens a saved chat from the URL', async () => {
    renderChat('/chatbot/c1')

    expect(screen.getByLabelText('Loading chat')).toBeInTheDocument()
    expect(await screen.findByText('Here are two phones.')).toBeInTheDocument()
    expect(screen.getByText('phone under 20k')).toBeInTheDocument()
    expect(screen.getByText('Search failed.')).toHaveClass('msg-error')
    expect(screen.getByRole('heading', { name: 'Phone One' })).toBeInTheDocument()
  })

  test('a missing chat says so and offers a new one', async () => {
    renderChat('/chatbot/gone')

    expect(await screen.findByRole('heading', { name: 'Chat not available' })).toBeInTheDocument()
    expect(screen.getByText('Chat not found.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Start a new chat' }))

    expect(screen.getByTestId('path')).toHaveTextContent(/^\/chatbot$/)
  })
})

describe('history sidebar', () => {
  test('lists chats and opens one', async () => {
    renderChat()

    fireEvent.click(screen.getByRole('button', { name: 'Chat history' }))
    fireEvent.click(await screen.findByTitle('Phones'))

    expect(screen.getByTestId('path')).toHaveTextContent('/chatbot/c1')
    expect(await screen.findByText('Here are two phones.')).toBeInTheDocument()
  })

  test('a failed chat list shows as empty', async () => {
    chatList = new Error('down')
    renderChat()

    expect(await screen.findByText('Your chats will appear here.')).toBeInTheDocument()
  })

  test('deleting the open chat starts a new one', async () => {
    renderChat('/chatbot/c1')
    await screen.findByText('Here are two phones.')

    fireEvent.click(screen.getByRole('button', { name: 'Delete chat: Phones' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(/^\/chatbot$/))
    expect(api).toHaveBeenCalledWith('/api/chats/c1', { method: 'DELETE' })
    expect(screen.queryByTitle('Phones')).not.toBeInTheDocument()
  })

  test('a failed delete is logged and the chat still leaves the list', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    chatList = [...chatList, { id: 'c2', title: 'Other', updatedAt: new Date().toISOString() }]
    renderChat()

    await screen.findByTitle('Other')
    api.mockRejectedValueOnce(new Error('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete chat: Other' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(screen.queryByTitle('Other')).not.toBeInTheDocument())
    expect(console.error).toHaveBeenCalled()
  })

  test('the new chat button clears the conversation', async () => {
    renderChat('/chatbot/c1')
    await screen.findByText('Here are two phones.')

    // The composer's button (the sidebar has one too).
    fireEvent.click(screen.getByTitle('New chat'))

    expect(screen.getByRole('heading', { name: 'What are you shopping for?' })).toBeInTheDocument()
    expect(screen.getByTestId('path')).toHaveTextContent(/^\/chatbot$/)
  })
})
