const express = require("express");
const { WishlistItem } = require("./db");
const { optionalAuth, requireAuth, requireDB } = require("./auth");
const { trustedMerchantUrl, trustedStoreFromUrl } = require("./merchant-urls");

// Saved products per user.
const MAX_ITEMS = 100;

const router = express.Router();

router.use(requireDB, optionalAuth, requireAuth);

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanPrice(value) {
  return Number.isSafeInteger(value) && value > 0 && value < 100000000
    ? value
    : null;
}

function cleanRating(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 5
    ? value
    : null;
}

function cleanReviews(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function cleanHttpsUrl(value, maxLength) {
  const candidate = cleanString(value, maxLength);

  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

// Keeps only the product card fields, so the client can't store anything else.
function cleanProduct(product) {
  return {
    id: cleanString(product.id, 300),
    name: cleanString(product.name, 300),
    price: cleanPrice(product.price),
    store: cleanString(product.store, 80),
    image: cleanHttpsUrl(product.image, 2000),
    rating: cleanRating(product.rating),
    reviews: cleanReviews(product.reviews),
    reason: cleanString(product.reason, 300),
    offers: (Array.isArray(product.offers) ? product.offers : [])
      .slice(0, 10)
      .map((offer) => {
        const link = trustedMerchantUrl(offer?.link);
        const store = link
          ? trustedStoreFromUrl(link)
          : cleanString(offer?.store, 80);

        return {
          store,
          price: cleanPrice(offer?.price),
          link
        };
      })
      .filter((offer) => offer.store)
  };
}

function toItem(item) {
  return {
    id: String(item._id),
    name: item.name,
    product: item.product,
    createdAt: item.createdAt
  };
}

router.get("/", async (req, res) => {
  const items = await WishlistItem.find({ user: req.userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(MAX_ITEMS)
    .lean();

  res.json({ items: items.map(toItem) });
});

router.post("/", async (req, res) => {
  const product =
    req.body.product && typeof req.body.product === "object"
      ? cleanProduct(req.body.product)
      : null;

  if (!product?.name || product.price === null) {
    return res.status(400).json({ message: "Please choose a product." });
  }

  const existing = await WishlistItem.findOne({
    user: req.userId,
    name: product.name
  });

  if (!existing) {
    const count = await WishlistItem.countDocuments({ user: req.userId });

    if (count >= MAX_ITEMS) {
      return res.status(400).json({
        message: `Your wishlist is full (${MAX_ITEMS} products). Remove some first.`
      });
    }
  }

  const item = existing || new WishlistItem({ user: req.userId, name: product.name });

  item.product = product;
  await item.save();

  res.status(existing ? 200 : 201).json({ item: toItem(item) });
});

// DELETE /api/wishlist?name=<product name>
router.delete("/", async (req, res) => {
  const name = typeof req.query.name === "string" ? req.query.name.trim() : "";

  const result = name
    ? await WishlistItem.deleteOne({ user: req.userId, name })
    : { deletedCount: 0 };

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Product not in your wishlist." });
  }

  res.status(204).end();
});

module.exports = {
  wishlistRouter: router
};
