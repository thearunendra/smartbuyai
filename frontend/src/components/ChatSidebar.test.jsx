// ChatSidebar: loading, empty, date groups, active chat and the two-click
// delete.

import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import ChatSidebar from './ChatSidebar'

const NOW = new Date(2026, 9, 3, 12, 0)

const chats = [
  { id: 'c1', title: 'Phones today', updatedAt: new Date(2026, 9, 3, 10) },
  { id: 'c2', title: 'Laptops yesterday', updatedAt: new Date(2026, 9, 2, 10) },
  { id: 'c3', title: 'TV last month', updatedAt: new Date(2026, 7, 1) }
]

let handlers

function renderSidebar(props = {}) {
  return render(
    <ChatSidebar chats={chats} activeId="c2" open={false} disabled={false} {...handlers} {...props} />
  )
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  handlers = {
    onClose: vi.fn(),
    onNew: vi.fn(),
    onOpen: vi.fn(),
    onDelete: vi.fn()
  }
})

afterEach(() => {
  vi.useRealTimers()
})

test('shows placeholders while chats load', () => {
  const { container } = renderSidebar({ chats: null })

  expect(container.querySelectorAll('.sidebar-skeleton')).toHaveLength(5)
})

test('says when there are no chats', () => {
  renderSidebar({ chats: [] })

  expect(screen.getByText('Your chats will appear here.')).toBeInTheDocument()
})

test('groups chats by date in order and marks the open chat', () => {
  const { container } = renderSidebar()

  expect([...container.querySelectorAll('.sidebar-group-label')].map((el) => el.textContent)).toEqual([
    'Today',
    'Yesterday',
    'Older'
  ])
  expect(screen.getByTitle('Laptops yesterday').parentElement).toHaveClass('active')
})

test('opens a chat and starts a new one', () => {
  renderSidebar()

  fireEvent.click(screen.getByTitle('Phones today'))
  fireEvent.click(screen.getByRole('button', { name: /New chat/ }))

  expect(handlers.onOpen).toHaveBeenCalledWith('c1')
  expect(handlers.onNew).toHaveBeenCalled()
})

describe('delete', () => {
  test('needs a second click to confirm', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Delete chat: Phones today' }))
    expect(handlers.onDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))
    expect(handlers.onDelete).toHaveBeenCalledWith('c1')
  })

  test('clicking elsewhere cancels the confirmation', () => {
    renderSidebar()

    fireEvent.click(screen.getByRole('button', { name: 'Delete chat: Phones today' }))
    fireEvent.blur(screen.getByRole('button', { name: 'Confirm delete' }))

    expect(screen.queryByRole('button', { name: 'Confirm delete' })).not.toBeInTheDocument()
    expect(handlers.onDelete).not.toHaveBeenCalled()
  })
})

test('when open, the backdrop and close button close it', () => {
  const { container } = renderSidebar({ open: true })

  expect(container.querySelector('.chat-sidebar')).toHaveClass('open')

  fireEvent.click(container.querySelector('.sidebar-backdrop'))
  fireEvent.click(screen.getByRole('button', { name: 'Close chat history' }))

  expect(handlers.onClose).toHaveBeenCalledTimes(2)
})

test('everything is disabled while a search runs', () => {
  renderSidebar({ disabled: true })

  expect(screen.getByRole('button', { name: /New chat/ })).toBeDisabled()
  expect(screen.getByTitle('Phones today')).toBeDisabled()
})
