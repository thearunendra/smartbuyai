// ProductDetails page: product from the chat vs. looked up by name, details
// loading and failure, wishlist for users and guests, gallery, tabs, share
// and the ask box. The API and sign-in are mocked.

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import ProductDetails from './ProductDetails'
import { api } from '../api'
import { useAuth } from '../auth'

vi.mock('../api', () => ({ api: vi.fn() }))
vi.mock('../auth', () => ({ useAuth: vi.fn() }))
vi.mock('../components/Navbar', () => ({ default: () => <nav aria-label="Navbar" /> }))

const product = {
  id: 'p1',
  name: 'Apple iPhone 15 (128 GB) - Pink',
  price: 59999,
  store: 'Amazon',
  image: 'https://img.example/main.jpg',
  rating: 4.6,
  reviews: 18432,
  reason: 'Great camera',
  offers: [
    { store: 'Amazon', price: 59999, link: 'https://amazon.in/iphone' },
    { store: 'Flipkart', price: 60499, link: 'https://flipkart.com/iphone' }
  ]
}

const details = {
  available: true,
  brand: 'Apple',
  shortName: 'iPhone 15',
  variant: ['128GB', 'Pink', '5G'],
  mrp: 64999,
  summary: 'The best balance of camera and battery.',
  pros: ['Excellent camera', 'Long software support'],
  highlights: [{ icon: 'chip', title: 'A16 Bionic', detail: 'Chip' }],
  specs: [{ group: 'Display', items: [{ label: 'Size', value: '6.1 inch' }] }],
  featureScore: 9,
  brandScore: 9,
  category: 'Smartphones',
  images: [{ url: 'https://img.example/second.jpg', thumb: 'https://thumb.example/second.jpg' }],
  alternatives: [
    { id: 'a1', name: 'Samsung Galaxy S24', price: 62000, store: 'Croma', rating: 4.5, reviews: 900 },
    { id: 'a2', name: 'Google Pixel 8a', price: 36999, store: 'Flipkart', rating: 4.3 }
  ]
}

// Answers by path, like the backend would.
function mockApi({ lookup, detailsReply = details, wishlist = [] } = {}) {
  api.mockImplementation(async (path, options = {}) => {
    if (path.startsWith('/api/product/details')) {
      if (detailsReply instanceof Error) throw detailsReply
      return detailsReply
    }

    if (path.startsWith('/api/product?')) {
      if (lookup instanceof Error) throw lookup
      return { product: lookup }
    }

    if (path.startsWith('/api/wishlist')) {
      if (options.method === 'POST') return { item: { name: options.body.product.name } }
      if (options.method === 'DELETE') return null
      return { items: wishlist.map((name) => ({ name })) }
    }

    throw new Error(`Unexpected call ${path}`)
  })
}

function CurrentPath() {
  const location = useLocation()

  return <p data-testid="path">{location.pathname + location.search}</p>
}

function renderPage({ name = product.name, state = { product } } = {}) {
  const search = name === null ? '' : `?name=${encodeURIComponent(name)}`

  return render(
    <MemoryRouter initialEntries={[{ pathname: '/product', search, state }]}>
      <Routes>
        <Route path="/product" element={<ProductDetails />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>
  )
}

const calledPaths = () => api.mock.calls.map(([path]) => path)

// The headline price (store offers repeat the same amounts).
const mainPrice = () => document.querySelector('.pd-price')

beforeEach(() => {
  api.mockReset()
  useAuth.mockReturnValue({ user: null, checking: false })
})

describe('product from the chat', () => {
  test('shows the product at once and the details when they arrive', async () => {
    mockApi()
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: product.name })).toBeInTheDocument()
    expect(mainPrice()).toHaveTextContent('₹59,999')

    // Details replace the long listing name with the model name.
    expect(await screen.findByRole('heading', { level: 1, name: 'iPhone 15' })).toBeInTheDocument()
    expect(screen.getByText('128GB • Pink • 5G')).toBeInTheDocument()
    expect(screen.getByText('₹64,999')).toBeInTheDocument()
    expect(screen.getByText('8% OFF')).toBeInTheDocument()
    expect(screen.getByText('You save ₹5,000')).toBeInTheDocument()
    expect(screen.getByText('The best balance of camera and battery.')).toBeInTheDocument()
    expect(screen.getByText('Excellent camera')).toBeInTheDocument()
    expect(screen.getByText('A16 Bionic')).toBeInTheDocument()
    expect(screen.getByText('6.1 inch')).toBeInTheDocument()
    expect(screen.getByText('Excellent choice!')).toBeInTheDocument()

    // The chat already had store offers: no lookup, and details know the price.
    expect(calledPaths()).not.toContainEqual(expect.stringMatching(/^\/api\/product\?/))
    expect(calledPaths()).toContainEqual(expect.stringContaining('price=59999'))
  })

  test('alternatives are split into similar and cheaper', async () => {
    mockApi()
    renderPage()

    const similar = (await screen.findByRole('heading', { name: 'Similar Products' })).closest('section')
    const cheaper = screen.getByRole('heading', { name: 'Cheaper Alternatives' }).closest('section')

    expect(within(similar).getByText('Samsung Galaxy S24')).toBeInTheDocument()
    expect(within(cheaper).getByText('Google Pixel 8a')).toBeInTheDocument()
    expect(within(cheaper).getByRole('link')).toHaveAttribute(
      'href',
      '/product?name=Google%20Pixel%208a'
    )
  })

  test('Buy Now opens the cheapest store with a link', async () => {
    mockApi()
    renderPage()

    expect(screen.getByRole('link', { name: /Buy Now on Amazon/ })).toHaveAttribute(
      'href',
      'https://amazon.in/iphone'
    )
  })

  test('without store links Buy Now is disabled', () => {
    mockApi()
    renderPage({
      state: { product: { ...product, offers: [{ store: 'Amazon', price: 59999, link: null }] } }
    })

    expect(screen.getByRole('button', { name: /No store link yet/ })).toBeDisabled()
  })

  test('failed details keep the live prices and say so', async () => {
    mockApi({ detailsReply: new Error('down') })
    renderPage()

    expect(await screen.findByText(/Product details aren't available right now/)).toBeInTheDocument()
    expect(screen.getByText("Specifications aren't available for this product yet.")).toBeInTheDocument()
    expect(screen.getByText('No similar products found at this price.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Buy Now on Amazon/ })).toBeInTheDocument()
  })
})

describe('product opened by link', () => {
  test('looks the product up, then loads details with its price', async () => {
    mockApi({ lookup: { ...product, price: 58990 } })
    renderPage({ state: null })

    expect(screen.getByLabelText('Loading product')).toBeInTheDocument()
    expect(await screen.findByText('₹58,990')).toBeInTheDocument()

    await waitFor(() =>
      expect(calledPaths()).toContainEqual(expect.stringContaining('price=58990'))
    )
  })

  test('a card without offers is shown while its offers are looked up', async () => {
    mockApi({ lookup: product })
    renderPage({ state: { product: { name: product.name, price: 60000, store: 'Croma' } } })

    expect(mainPrice()).toHaveTextContent('₹60,000')
    await waitFor(() => expect(mainPrice()).toHaveTextContent('₹59,999'))
  })

  test('shows an error when the product is not found', async () => {
    mockApi({ lookup: new Error('Product not found.') })
    renderPage({ state: null })

    expect(await screen.findByRole('heading', { name: 'Product not available' })).toBeInTheDocument()
    expect(screen.getByText('Product not found.')).toBeInTheDocument()
  })

  test('without a name there is nothing to show', () => {
    renderPage({ name: null, state: null })

    expect(screen.getByRole('heading', { name: 'No product selected' })).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
  })
})

describe('wishlist', () => {
  test('guests are sent to sign in and back', () => {
    mockApi()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Add to Wishlist/ }))

    expect(screen.getByTestId('path')).toHaveTextContent(
      `/login?next=${encodeURIComponent(`/product?name=${encodeURIComponent(product.name)}`)}`
    )
  })

  test('signed-in users can add and remove the product', async () => {
    useAuth.mockReturnValue({ user: { name: 'Asha' }, checking: false })
    mockApi()
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /Add to Wishlist/ }))

    expect(await screen.findByRole('button', { name: /In Wishlist/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('Added to your wishlist')
    expect(api).toHaveBeenCalledWith('/api/wishlist', { method: 'POST', body: { product } })

    fireEvent.click(screen.getByRole('button', { name: /In Wishlist/ }))

    expect(await screen.findByRole('button', { name: /Add to Wishlist/ })).toBeInTheDocument()
    expect(api).toHaveBeenCalledWith(
      `/api/wishlist?name=${encodeURIComponent(product.name)}`,
      { method: 'DELETE' }
    )
  })

  test('a saved product shows as saved', async () => {
    useAuth.mockReturnValue({ user: { name: 'Asha' }, checking: false })
    mockApi({ wishlist: [product.name] })
    renderPage()

    expect(await screen.findByRole('button', { name: /In Wishlist/ })).toBeInTheDocument()
  })

  test('errors are shown to the user', async () => {
    useAuth.mockReturnValue({ user: { name: 'Asha' }, checking: false })
    mockApi()
    renderPage()

    await screen.findByRole('heading', { level: 1, name: 'iPhone 15' })
    api.mockRejectedValueOnce(new Error('Your wishlist is full.'))
    fireEvent.click(screen.getByRole('button', { name: /Add to Wishlist/ }))

    expect(await screen.findByRole('status')).toHaveTextContent('Your wishlist is full.')
  })
})

describe('gallery', () => {
  test('thumbnails switch the main image', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await screen.findByLabelText('Image 2'))

    expect(screen.getByRole('img', { name: product.name })).toHaveAttribute(
      'src',
      'https://img.example/second.jpg'
    )
  })

  test('a blocked image falls back to its thumbnail, then disappears', async () => {
    mockApi()
    renderPage()

    fireEvent.click(await screen.findByLabelText('Image 2'))

    const main = () => screen.getByRole('img', { name: product.name })

    fireEvent.error(main())
    expect(main()).toHaveAttribute('src', 'https://thumb.example/second.jpg')

    fireEvent.error(main())
    // Only the first image is left, so no thumbnails are needed.
    expect(main()).toHaveAttribute('src', product.image)
    expect(screen.queryByLabelText('Image 2')).not.toBeInTheDocument()
  })
})

describe('tabs, share and ask', () => {
  test('a clicked tab is highlighted and its section scrolled to', async () => {
    mockApi()
    renderPage()

    const tab = await screen.findByRole('button', { name: /Specifications/ })

    fireEvent.click(tab)

    expect(tab).toHaveClass('active')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  test('Share copies the link when the share sheet is missing', async () => {
    const writeText = vi.fn().mockResolvedValue()

    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    mockApi()
    renderPage()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Share/ }))
    })

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/product?name=${encodeURIComponent(product.name)}`
    )
    expect(screen.getByRole('status')).toHaveTextContent('Link copied')
  })

  test('Share uses the share sheet when there is one', async () => {
    const share = vi.fn().mockResolvedValue()

    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    mockApi()
    renderPage()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Share/ }))
    })

    expect(share).toHaveBeenCalledWith({ title: product.name, url: expect.stringContaining('/product?name=') })
    delete navigator.share
  })

  test('the ask box opens the chatbot with the question', async () => {
    mockApi()
    renderPage()

    const input = screen.getByRole('textbox', { name: 'Ask SmartBuy AI' })
    const ask = screen.getByRole('button', { name: 'Ask' })

    expect(ask).toBeDisabled()

    fireEvent.change(input, { target: { value: 'Is it worth it?' } })
    fireEvent.click(ask)

    expect(screen.getByTestId('path')).toHaveTextContent('/chatbot?q=Is%20it%20worth%20it%3F')
  })
})
