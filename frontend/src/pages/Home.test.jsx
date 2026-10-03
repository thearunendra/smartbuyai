// Home page: the ask box, suggestion chips and department links.

import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import Home from './Home'

vi.mock('../components/Navbar', () => ({ default: () => <nav aria-label="Navbar" /> }))

function Where() {
  const location = useLocation()
  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  )
}

test('asking a question opens the chatbot with it', () => {
  renderHome()

  fireEvent.change(screen.getByRole('textbox', { name: 'Ask SmartBuy AI' }), {
    target: { value: '  tv under 30k  ' }
  })
  fireEvent.click(screen.getByRole('button', { name: /Ask AI/ }))

  expect(screen.getByTestId('path')).toHaveTextContent('/chatbot?q=tv%20under%2030k')
})

test('an empty question does nothing', () => {
  renderHome()

  fireEvent.click(screen.getByRole('button', { name: /Ask AI/ }))

  expect(screen.queryByTestId('path')).not.toBeInTheDocument()
})

test('a suggestion chip asks that question', () => {
  renderHome()

  fireEvent.click(screen.getByRole('button', { name: 'Gaming laptop under ₹80,000' }))

  expect(screen.getByTestId('path')).toHaveTextContent(
    `/chatbot?q=${encodeURIComponent('Gaming laptop under ₹80,000')}`
  )
})

test('department cards open the products page', () => {
  renderHome()

  expect(screen.getByRole('link', { name: /Furniture/ })).toHaveAttribute(
    'href',
    '/products?department=Furniture'
  )
})
