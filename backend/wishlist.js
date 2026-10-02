const express = require("express");
const { WishlistItem } = require("./db");
const { optionalAuth, requireAuth, requireDB } = require("./auth");

// Saved products per user.
const MAX_ITEMS = 100;

const router = express.Router();

router.use(requireDB, optionalAuth, requireAuth);

function cleanNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanString(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

// Keeps only the product card fields, so the client can't store anything else.
function cleanProduct(product) {
  return {
    id: cleanString(product.id, 300),
    name: cleanString(product.name, 300),
    price: cleanNumber(product.price),
    store: cleanString(product.store, 80),
    image: cleanString(product.image, 2000) || null,
    rating: cleanNumber(product.rating),
    reviews: cleanNumber(product.reviews),
    reason: cleanString(product.reason, 300),
    offers: (Array.isArray(product.offers) ? product.offers : [])
      .slice(0, 10)
      .map((offer) => ({
        store: cleanString(offer?.store, 80),
        price: cleanNumber(offer?.price),
        link: cleanString(offer?.link, 2000) || null
      }))
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
