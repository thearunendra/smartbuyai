// White-box tests for the details page logic: discount, SmartBuy Score
// (every part, verdict and sentence form), badges and alternatives.

import { describe, expect, test } from 'vitest'
import {
  formatPrice,
  getDiscount,
  offerPrices,
  productBadges,
  productPath,
  smartScore,
  splitAlternatives
} from './product'

describe('productPath and formatPrice', () => {
  test('encodes the product name', () => {
    expect(productPath({ name: 'Galaxy S24+ (5G) & more' })).toBe(
      '/product?name=Galaxy%20S24%2B%20(5G)%20%26%20more'
    )
  })

  test('formats rupees the Indian way', () => {
    expect(formatPrice(134900)).toBe('₹1,34,900')
  })
})

describe('getDiscount', () => {
  const product = { price: 59999 }

  test('gives the MRP, saving and rounded percent', () => {
    expect(getDiscount(product, { mrp: 64999 })).toEqual({
      mrp: 64999,
      saving: 5000,
      percent: 8
    })
  })

  test.each([
    ['no details', null],
    ['no MRP', { mrp: null }],
    ['an MRP equal to the price', { mrp: 59999 }],
    ['an MRP below the price', { mrp: 50000 }],
    ['an MRP over 3x the price', { mrp: 200000 }]
  ])('is null with %s', (_, details) => {
    expect(getDiscount(product, details)).toBeNull()
  })
})

describe('offerPrices', () => {
  test('known prices, cheapest first', () => {
    expect(
      offerPrices({ offers: [{ price: 900 }, { price: null }, { price: 700 }, {}] })
    ).toEqual([700, 900])
  })

  test('no offers gives an empty list', () => {
    expect(offerPrices({})).toEqual([])
  })
})

describe('smartScore', () => {
  test('is null when nothing can be scored', () => {
    expect(smartScore({ price: 100 }, null)).toBeNull()
  })

  test('uses every part, from the MRP discount and well-reviewed ratings', () => {
    const score = smartScore(
      { price: 90, rating: 4.5, reviews: 9999, offers: [] },
      { mrp: 100, featureScore: 9, brandScore: 8 }
    )

    expect(score.rows).toEqual([
      { key: 'price', label: 'Price', score: 8 },
      { key: 'ratings', label: 'Ratings & Reviews', score: 9 },
      { key: 'features', label: 'Features', score: 9 },
      { key: 'brand', label: 'Brand Value', score: 8 },
      { key: 'value', label: 'Value for Money', score: 8.5 }
    ])
    expect(score.overall).toBe(8.5)
    expect(score.title).toBe('Excellent choice!')
    expect(score.text).toBe(
      'A great price, high ratings, strong features and a trusted brand make this a solid buy right now.'
    )
  })

  test('without an MRP, the price part compares store prices', () => {
    const score = smartScore(
      { price: 800, offers: [{ price: 800 }, { price: 1000 }, { price: null }] },
      null
    )

    // 20% below the priciest store: 6 + 0.2 * 20 = 10.
    expect(score.rows).toEqual([
      { key: 'price', label: 'Price', score: 10 },
      { key: 'value', label: 'Value for Money', score: 10 }
    ])
  })

  test('a single store price gives no price part', () => {
    const score = smartScore({ price: 800, offers: [{ price: 800 }] }, { featureScore: 7 })

    expect(score.rows.map((row) => row.key)).toEqual(['features', 'value'])
  })

  test.each([
    // Few reviews pull the rating towards 6.
    [{ rating: 5, reviews: 0 }, 6],
    [{ rating: 4, reviews: 99 }, 7],
    [{ rating: 4, reviews: undefined }, 6]
  ])('ratings %o score %d', (ratings, expected) => {
    const score = smartScore({ price: 1, ...ratings }, null)

    expect(score.rows[0]).toEqual({ key: 'ratings', label: 'Ratings & Reviews', score: expected })
  })

  test.each([
    [{ featureScore: 8.5, brandScore: 5 }, 'Good choice', 'Strong features make this a solid buy right now.'],
    [
      { featureScore: 6, brandScore: 5 },
      'Decent option',
      'It does the job, but check the alternatives below before you buy.'
    ],
    [
      { featureScore: 3, brandScore: 4 },
      'Compare before buying',
      'It does the job, but check the alternatives below before you buy.'
    ]
  ])('verdict for %o', (details, title, text) => {
    const score = smartScore({ price: 100 }, details)

    expect(score.title).toBe(title)
    expect(score.text).toBe(text)
  })

  test('two strengths are joined with "and"', () => {
    const score = smartScore({ price: 1, rating: 4.5, reviews: 9999 }, { brandScore: 9 })

    expect(score.text).toBe('High ratings and a trusted brand make this a solid buy right now.')
  })
})

describe('productBadges', () => {
  test.each([
    [{ rating: 4.6, reviews: 200 }, ['top']],
    [{ rating: 4.3, reviews: 1000 }, ['popular']],
    [{ rating: 4.6, reviews: 5000 }, ['top', 'popular']],
    [{ rating: 4.5, reviews: 99 }, []],
    [{ rating: null, reviews: null }, []]
  ])('%o -> %o', (product, keys) => {
    expect(productBadges(product, null).map((badge) => badge.key)).toEqual(keys)
  })

  test('a high price score adds Great Value', () => {
    const score = { rows: [{ key: 'price', score: 8 }] }

    expect(productBadges({}, score)).toEqual([{ key: 'value', label: 'Great Value' }])
    expect(productBadges({}, { rows: [{ key: 'price', score: 7.9 }] })).toEqual([])
  })
})

describe('splitAlternatives', () => {
  const item = (name, price, rating = null) => ({ name, price, rating })

  test('splits by price band and sorts each list', () => {
    const { similar, cheaper } = splitAlternatives(
      [
        item('same', 100),
        item('top of band', 130),
        item('too pricey', 131),
        item('bottom of band', 85),
        item('just cheaper', 84.9, 4.0),
        item('cheapest allowed', 30, 4.5),
        item('too cheap', 29, 5),
        item('close below', 90),
        item('close above', 110),
        item('tie on rating', 50, 4.5)
      ],
      100
    )

    // Closest price first, at most 4.
    expect(similar.map((x) => x.name)).toEqual(['same', 'close below', 'close above', 'bottom of band'])
    // Best rated first, then cheaper first.
    expect(cheaper.map((x) => x.name)).toEqual(['cheapest allowed', 'tie on rating', 'just cheaper'])
  })

  test('keeps at most 4 cheaper alternatives, unrated last', () => {
    const { cheaper } = splitAlternatives(
      [item('a', 50), item('b', 60, 4), item('c', 70, 3), item('d', 40, 4), item('e', 45, 5)],
      100
    )

    expect(cheaper.map((x) => x.name)).toEqual(['e', 'd', 'b', 'c'])
  })
})
