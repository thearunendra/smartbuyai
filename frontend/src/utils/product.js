// Link to a product's details page. The name is enough to rebuild the page
// (shared links, new tabs); the card passes the full product as router state.
export function productPath(product) {
  return `/product?name=${encodeURIComponent(product.name)}`;
}

export function formatPrice(price) {
  return `₹${price.toLocaleString("en-IN")}`;
}

function clamp(value) {
  return Math.min(10, Math.max(0, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function average(values) {
  const known = values.filter((value) => value !== null && value !== undefined);

  return known.length > 0
    ? known.reduce((sum, value) => sum + value, 0) / known.length
    : null;
}

// MRP discount, only when the MRP is believable for this price.
export function getDiscount(product, details) {
  const mrp = details?.mrp;

  if (!mrp || mrp <= product.price || mrp > product.price * 3) {
    return null;
  }

  return {
    mrp,
    saving: mrp - product.price,
    percent: Math.round(((mrp - product.price) / mrp) * 100)
  };
}

// Known store prices, cheapest first.
export function offerPrices(product) {
  return (product.offers || [])
    .map((offer) => offer.price)
    .filter((price) => price !== null && price !== undefined)
    .sort((a, b) => a - b);
}

// Saving against the MRP, else against the priciest store (0 to 1).
function priceSaving(product, details) {
  const discount = getDiscount(product, details);

  if (discount) {
    return discount.percent / 100;
  }

  const prices = offerPrices(product);

  if (prices.length < 2) {
    return null;
  }

  const highest = prices[prices.length - 1];

  return (highest - product.price) / highest;
}

// More reviews make the rating count for more; few reviews pull it
// towards an average score of 6.
function ratingScore(product) {
  if (!product.rating) {
    return null;
  }

  const confidence = Math.min(1, Math.log10((product.reviews || 0) + 1) / 4);

  return clamp(product.rating * 2 * confidence + 6 * (1 - confidence));
}

const STRENGTHS = {
  price: "a great price",
  ratings: "high ratings",
  features: "strong features",
  brand: "a trusted brand"
};

function verdict(overall, parts) {
  const strengths = Object.keys(STRENGTHS)
    .filter((key) => parts[key] !== null && parts[key] >= 8)
    .map((key) => STRENGTHS[key]);

  const title =
    overall >= 8.5
      ? "Excellent choice!"
      : overall >= 7
        ? "Good choice"
        : overall >= 5.5
          ? "Decent option"
          : "Compare before buying";

  if (strengths.length === 0) {
    return {
      title,
      text: "It does the job, but check the alternatives below before you buy."
    };
  }

  const list =
    strengths.length === 1
      ? strengths[0]
      : `${strengths.slice(0, -1).join(", ")} and ${strengths.at(-1)}`;

  return {
    title,
    text: `${list.charAt(0).toUpperCase()}${list.slice(1)} make this a solid buy right now.`
  };
}

// SmartBuy Score (0-10): price and ratings come from live data, features
// and brand from the AI details. Missing parts are left out of the average.
export function smartScore(product, details) {
  const saving = priceSaving(product, details);
  const price = saving === null ? null : clamp(6 + saving * 20);
  const features = details?.featureScore ?? null;

  const parts = {
    price,
    ratings: ratingScore(product),
    features,
    brand: details?.brandScore ?? null,
    value: average([price, features])
  };

  const overall = average(Object.values(parts));

  if (overall === null) {
    return null;
  }

  const rows = [
    { key: "price", label: "Price" },
    { key: "ratings", label: "Ratings & Reviews" },
    { key: "features", label: "Features" },
    { key: "brand", label: "Brand Value" },
    { key: "value", label: "Value for Money" }
  ]
    .filter((row) => parts[row.key] !== null)
    .map((row) => ({ ...row, score: round1(parts[row.key]) }));

  return {
    overall: round1(overall),
    rows,
    ...verdict(overall, parts)
  };
}

// Badges from live data only (no sales ranks are available).
export function productBadges(product, score) {
  const badges = [];

  if (product.rating >= 4.5 && product.reviews >= 100) {
    badges.push({ key: "top", label: "Top Rated" });
  }

  if (product.rating >= 4.2 && product.reviews >= 1000) {
    badges.push({ key: "popular", label: "Popular Choice" });
  }

  const priceRow = score?.rows.find((row) => row.key === "price");

  if (priceRow && priceRow.score >= 8) {
    badges.push({ key: "value", label: "Great Value" });
  }

  return badges;
}

// Similar: about the same price. Cheaper: clearly cheaper, but not so cheap
// that it is likely an accessory or a different class of product.
export function splitAlternatives(alternatives, price) {
  const similar = alternatives
    .filter((item) => item.price >= price * 0.85 && item.price <= price * 1.3)
    .sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price))
    .slice(0, 4);

  const cheaper = alternatives
    .filter((item) => item.price < price * 0.85 && item.price >= price * 0.3)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.price - b.price)
    .slice(0, 4);

  return { similar, cheaper };
}
