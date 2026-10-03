// Products page and CategoryTabs: URL-driven category/department, search,
// sorting, loading, empty and error states, and the tab scroll arrows.

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import Products from './Products'
import CategoryTabs from '../components/CategoryTabs'
import { DEPARTMENTS } from '../data/categories'

vi.mock('../components/Navbar', () => ({ default: () => <nav aria-label="Navbar" /> }))

const listings = [
  { id: 'a', name: 'Phone A', price: 20000, store: 'Amazon', rating: 4.1 },
  { id: 'b', name: 'Phone B', price: 10000, store: 'Flipkart', rating: 4.6 },
  { id: 'c', name: 'Phone C', price: 15000, store: 'Croma' }
]

let fetchMock

function respond(body) {
  fetchMock.mockResolvedValue({ json: async () => body })
}

function renderProducts(url = '/products') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Products />
    </MemoryRouter>
  )
}

const lastRequest = () => new URL(fetchMock.mock.calls.at(-1)[0]).searchParams
const names = () => screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  respond({ products: listings })
})

describe('Products', () => {
  test('loads the first category and shows the listings', async () => {
    renderProducts()

    expect(screen.getByText(/Fetching live listings/)).toBeInTheDocument()
    expect(await screen.findByText('Showing 3 live listings in Smartphones')).toBeInTheDocument()
    expect(lastRequest().get('category')).toBe('Smartphones')
    expect(lastRequest().has('q')).toBe(false)
  })

  test('?department picks its first category, ?category picks its department', async () => {
    const { unmount } = renderProducts('/products?department=Furniture')

    await screen.findByText(/live listings in Sofas/)
    expect(screen.getByRole('tab', { name: /Furniture/ })).toHaveAttribute('aria-selected', 'true')
    unmount()

    renderProducts('/products?category=Laptops')

    await screen.findByText(/live listings in Laptops/)
    expect(screen.getByRole('tab', { name: /Electronics/ })).toHaveAttribute('aria-selected', 'true')
  })

  test('unknown names fall back to the first department', async () => {
    renderProducts('/products?category=Rockets&department=Space')

    expect(await screen.findByText(/live listings in Smartphones/)).toBeInTheDocument()
  })

  test('clicking a category or department loads it', async () => {
    renderProducts()
    await screen.findByText(/in Smartphones/)

    fireEvent.click(screen.getByRole('tab', { name: /Laptops/ }))
    await waitFor(() => expect(lastRequest().get('category')).toBe('Laptops'))

    fireEvent.click(screen.getByRole('tab', { name: /Fashion/ }))
    await waitFor(() => expect(lastRequest().get('category')).toBe("Men's Clothing"))
  })

  test('searching adds the text, and clearing it goes back', async () => {
    renderProducts()
    await screen.findByText(/in Smartphones/)

    const box = screen.getByPlaceholderText('Search any product and press Enter')

    fireEvent.change(box, { target: { value: '  red sofa ' } })
    fireEvent.submit(box.closest('form'))

    expect(await screen.findByText('"red sofa"')).toBeInTheDocument()
    expect(lastRequest().get('q')).toBe('red sofa')

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

    await waitFor(() => expect(lastRequest().has('q')).toBe(false))
    expect(box).toHaveValue('')
  })

  test('an empty search keeps just the category', async () => {
    renderProducts()
    await screen.findByText(/in Smartphones/)

    fireEvent.submit(screen.getByPlaceholderText('Search any product and press Enter').closest('form'))

    await waitFor(() => expect(lastRequest().has('q')).toBe(false))
  })

  test.each([
    ['', ['Phone A', 'Phone B', 'Phone C']],
    ['low', ['Phone B', 'Phone C', 'Phone A']],
    ['high', ['Phone A', 'Phone C', 'Phone B']],
    ['rating', ['Phone B', 'Phone A', 'Phone C']]
  ])('sort "%s"', async (sort, expected) => {
    renderProducts()
    await screen.findByText(/in Smartphones/)

    fireEvent.change(screen.getByRole('combobox', { name: 'Sort products' }), {
      target: { value: sort }
    })

    expect(names()).toEqual(expected)
  })

  test("shows the server's message when nothing is found", async () => {
    respond({ products: [], message: 'Unable to fetch live products right now.' })
    renderProducts()

    expect(await screen.findByText('No products found')).toBeInTheDocument()
    expect(screen.getByText('Unable to fetch live products right now.')).toBeInTheDocument()
  })

  test('an empty result without a message suggests trying again', async () => {
    respond({})
    renderProducts()

    expect(await screen.findByText('Try another search or category.')).toBeInTheDocument()
  })

  test('a network error says the API is unreachable', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('Failed to fetch'))
    renderProducts()

    expect(await screen.findByText('Unable to connect to SmartBuy AI.')).toBeInTheDocument()
  })
})

describe('CategoryTabs', () => {
  function renderTabs(active = 'Electronics') {
    const onSelect = vi.fn()
    const utils = render(<CategoryTabs categories={DEPARTMENTS} active={active} onSelect={onSelect} />)

    return { ...utils, onSelect, scroller: utils.container.querySelector('.tabs-scroller') }
  }

  function size(scroller, { left, width, total }) {
    Object.defineProperty(scroller, 'scrollLeft', { value: left, configurable: true })
    Object.defineProperty(scroller, 'clientWidth', { value: width, configurable: true })
    Object.defineProperty(scroller, 'scrollWidth', { value: total, configurable: true })
    fireEvent.scroll(scroller)
  }

  test('selecting a tab reports it', () => {
    const { onSelect } = renderTabs()

    fireEvent.click(screen.getByRole('tab', { name: /Fashion/ }))

    expect(onSelect).toHaveBeenCalledWith('Fashion')
    expect(screen.getByRole('tab', { name: /Electronics/ })).toHaveClass('active')
  })

  test('arrows appear on the sides that can scroll', () => {
    const { scroller, container } = renderTabs()

    size(scroller, { left: 0, width: 300, total: 300 })
    expect(screen.queryByRole('button', { name: /Scroll categories/ })).not.toBeInTheDocument()

    size(scroller, { left: 0, width: 300, total: 1000 })
    expect(screen.getByRole('button', { name: 'Scroll categories right' })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('fade-right')

    size(scroller, { left: 700, width: 300, total: 1000 })
    expect(screen.getByRole('button', { name: 'Scroll categories left' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Scroll categories right' })).not.toBeInTheDocument()
  })

  test('arrows scroll by most of the visible width', () => {
    const { scroller } = renderTabs()

    size(scroller, { left: 200, width: 300, total: 1000 })

    fireEvent.click(screen.getByRole('button', { name: 'Scroll categories right' }))
    expect(scroller.scrollBy).toHaveBeenLastCalledWith({ left: 210, behavior: 'smooth' })

    fireEvent.click(screen.getByRole('button', { name: 'Scroll categories left' }))
    expect(scroller.scrollBy).toHaveBeenLastCalledWith({ left: -210, behavior: 'smooth' })
  })

  test('the selected tab is scrolled into view', () => {
    const { scroller } = renderTabs('Fashion')

    expect(scroller.scrollTo).toHaveBeenCalledWith({ left: 0, behavior: 'smooth' })
  })
})
