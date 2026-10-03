// ProductCard and StoreOffers: every optional part and both offer kinds.

import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, test } from 'vitest'
import ProductCard, { ProductCardSkeleton } from './ProductCard'
import StoreOffers from './StoreOffers'

const product = {
  id: 'p1',
  name: 'Apple iPhone 15',
  price: 58990,
  store: 'Reliance Digital',
  image: 'https://img.example/iphone.jpg',
  rating: 4.6,
  reviews: 30000,
  reason: 'Great camera and long updates',
  offers: [
    { store: 'Reliance Digital', price: 58990, link: 'https://reliancedigital.in/p' },
    { store: 'Flipkart', price: 59900, link: 'https://flipkart.com/p' },
    { store: 'Croma', price: null, link: null }
  ]
}

function renderCard(props) {
  return render(
    <MemoryRouter>
      <ProductCard {...props} />
    </MemoryRouter>
  )
}

describe('ProductCard', () => {
  test('shows everything a full product has', () => {
    renderCard({ product, layout: 'row' })

    expect(screen.getByRole('heading', { name: 'Apple iPhone 15' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Apple iPhone 15' })).toHaveAttribute('src', product.image)
    expect(screen.getByText('(30,000)')).toBeInTheDocument()
    expect(document.querySelector('.product-price')).toHaveTextContent('₹58,990at Reliance Digital')
    expect(screen.getByText('Great camera and long updates')).toBeInTheDocument()
    expect(screen.getByRole('article')).toHaveClass('product-card-row')
  })

  test('"View details" opens the details page for this product', () => {
    renderCard({ product })

    expect(screen.getByRole('link', { name: /View details/ })).toHaveAttribute(
      'href',
      '/product?name=Apple%20iPhone%2015'
    )
    expect(screen.getByRole('article')).toHaveClass('product-card-grid')
  })

  test('leaves out what a product lacks', () => {
    renderCard({
      product: { name: 'Plain Kettle', price: 999, store: 'Amazon', rating: 4.1 }
    })

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText(/\(\d/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Compared across/)).not.toBeInTheDocument()
  })

  test('no rating means no rating row', () => {
    const { container } = renderCard({ product: { name: 'X', price: 1, store: 'Y' } })

    expect(container.querySelector('.product-rating')).toBeNull()
  })

  test('the skeleton is hidden from screen readers', () => {
    const { container } = render(<ProductCardSkeleton layout="row" />)

    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('StoreOffers', () => {
  test('renders nothing without offers', () => {
    expect(render(<StoreOffers offers={[]} />).container).toBeEmptyDOMElement()
    expect(render(<StoreOffers />).container).toBeEmptyDOMElement()
  })

  test('marks the lowest price and links only offers with a link', () => {
    render(<StoreOffers offers={product.offers} />)

    expect(screen.getByText('Compared across 3 stores')).toBeInTheDocument()

    const links = screen.getAllByRole('link')

    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', 'https://reliancedigital.in/p')
    expect(links[0]).toHaveClass('offer-lowest')
    expect(within(links[0]).getByText('Lowest')).toBeInTheDocument()
    expect(links[1]).not.toHaveClass('offer-lowest')

    expect(screen.getByText('See price')).toBeInTheDocument()
    expect(screen.getByText('No link')).toBeInTheDocument()
  })

  test('a single store uses the singular', () => {
    render(<StoreOffers offers={[{ store: 'Amazon', price: 100, link: null }]} />)

    expect(screen.getByText('Compared across 1 store')).toBeInTheDocument()
  })

  test('with no known price nothing is marked lowest', () => {
    render(<StoreOffers offers={[{ store: 'Croma', price: null, link: 'https://croma.com' }]} />)

    expect(screen.queryByText('Lowest')).not.toBeInTheDocument()
  })
})
