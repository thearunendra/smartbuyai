// The Express app and the search pipeline. server.js loads .env and starts
// it; tests load this file directly with their own environment.

const express = require("express");
const { GoogleGenAI } = require("@google/genai");
const { cacheKey, getCached, setCached, cacheMode } = require("./cache");
const { Conversation, SearchLog, User, isDBReady } = require("./db");
const {
  authRouter,
  optionalAuth,
  requireAdmin,
  requireAuth,
  requireDB
} = require("./auth");
const { chatsRouter, saveExchange } = require("./chats");
const { wishlistRouter } = require("./wishlist");
const { applySecurity, searchLimiter } = require("./security");

const app = express();

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const SERPER_API_KEY = process.env.SERPER_API_KEY;

const MAX_QUERY_LENGTH = 200;

// Products page size. Each product costs 1 Serper credit to compare.
const PRODUCTS_PER_PAGE = 9;

// Browse categories (product types) and the Google Shopping search used for
// each. Keep names in sync with DEPARTMENTS in frontend/src/data/categories.js.
const CATEGORY_QUERIES = {
  // Electronics
  Smartphones: "best 5g smartphone",
  Laptops: "best laptop",
  Tablets: "best tablet",
  Televisions: "best smart tv 4k",
  Monitors: "best monitor",
  Headphones: "best over ear headphones",
  Earbuds: "best true wireless earbuds",
  Speakers: "best bluetooth speaker",
  Smartwatches: "best smartwatch",
  Cameras: "best camera",
  Gaming: "gaming console playstation xbox",
  Printers: "best printer for home",
  Keyboards: "best keyboard",
  Mice: "best wireless mouse",
  Routers: "best wifi router",
  "Power Banks": "best power bank fast charging",
  Storage: "best portable ssd",
  Projectors: "best projector for home",
  Drones: "best camera drone",

  // Home Appliances
  "Air Conditioners": "best 1.5 ton split ac",
  Refrigerators: "best refrigerator",
  "Washing Machines": "best washing machine",
  Microwaves: "best microwave oven",
  Fans: "best bldc ceiling fan",
  "Water Purifiers": "best ro water purifier",
  "Vacuum Cleaners": "best vacuum cleaner for home",
  "Air Purifiers": "best air purifier for home",
  Geysers: "best water heater geyser",

  // Furniture
  Sofas: "best 3 seater sofa",
  Beds: "best queen size bed with storage",
  Mattresses: "best memory foam mattress",
  "Office Chairs": "best ergonomic office chair",
  "Study Tables": "best study table",
  Wardrobes: "best wardrobe for bedroom",
  Bookshelves: "best bookshelf",

  // Home Essentials
  Bedsheets: "best cotton double bedsheet",
  Curtains: "best blackout curtains",
  Lighting: "best led ceiling light",
  "Home Decor": "home decor items for living room",
  "Storage Organisers": "storage organiser boxes for home",
  "Cleaning Supplies": "best floor cleaner mop",
  "Bath Towels": "best cotton bath towel",

  // Kitchen & Dining
  Cookware: "best non stick cookware set",
  "Mixer Grinders": "best mixer grinder",
  "Pressure Cookers": "best pressure cooker",
  "Dinner Sets": "best dinner set",
  "Water Bottles": "best insulated water bottle",
  "Coffee Makers": "best coffee maker",
  "Kitchen Storage": "kitchen storage containers set",

  // Fashion
  "Men's Clothing": "men's casual shirt",
  "Women's Clothing": "women's kurta set",
  Footwear: "best sneakers for men and women",
  Watches: "best analog watch",
  Bags: "best laptop backpack",
  Sunglasses: "best polarized sunglasses",
  Jewellery: "fashion jewellery set for women",

  // Beauty & Personal Care
  Trimmers: "best beard trimmer",
  "Hair Dryers": "best hair dryer",
  Skincare: "best face serum",
  Perfumes: "best perfume long lasting",
  Makeup: "best makeup kit",
  "Electric Toothbrushes": "best electric toothbrush",

  // Sports & Fitness
  Dumbbells: "adjustable dumbbells set for home gym",
  Treadmills: "best treadmill for home",
  Cycles: "best cycle for adults",
  "Yoga Mats": "best yoga mat",
  Cricket: "cricket bat english willow",
  "Camping Gear": "camping tent"
};

// Categories Gemini can assign to a chat search (used in admin stats).
const CATEGORIES = [...Object.keys(CATEGORY_QUERIES), "Other"];

applySecurity(app);
app.use(express.json({ limit: "20kb" }));

app.use("/api/auth", authRouter);
app.use("/api/chats", chatsRouter);
app.use("/api/wishlist", wishlistRouter);

// Used by Render's health check and for a quick "is it up?" test.
app.get("/api/health", (req, res) => {
  res.json({ ok: true, database: isDBReady() ? "connected" : "disconnected" });
});

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

// The free tier allows 15 requests a minute for this model. Calls beyond
// GEMINI_RPM in the last minute wait for a slot instead of failing.
const GEMINI_RPM = Number(process.env.GEMINI_RPM) || 14;
const geminiCalls = [];

async function generate(params) {
  for (;;) {
    const now = Date.now();

    while (geminiCalls.length > 0 && now - geminiCalls[0] >= 60000) {
      geminiCalls.shift();
    }

    if (geminiCalls.length < GEMINI_RPM) {
      break;
    }

    await new Promise((resolve) =>
      setTimeout(resolve, 60000 - (now - geminiCalls[0]) + 50)
    );
  }

  geminiCalls.push(Date.now());

  return ai.models.generateContent({ model: GEMINI_MODEL, ...params });
}


// =====================================================
// SEARCH LOG (ADMIN STATS)
// =====================================================

async function logSearch(query, category, results, userId) {
  try {
    await SearchLog.create({
      query,
      category: category || "Other",
      results: results.length,
      products: results.map((product) => product.name),
      user: userId
    });
  } catch (error) {
    console.log("Search Log Error:", error.message);
  }
}


// =====================================================
// BUDGET DETECTION
// =====================================================

// Converts "20000", "20,000", "20k" or "1.5 lakh" to a number of rupees.
function toRupees(amount, unit) {
  const value = Number(amount.replace(/,/g, ""));

  if (!unit) {
    return value;
  }

  if (unit === "k" || unit === "thousand") {
    return value * 1000;
  }

  return value * 100000;
}

function extractBudget(query) {
  const text = query.toLowerCase();

  const match = text.match(
    /(?:under|below|less than|within|upto|up to|max|maximum|budget(?: of| is)?)\s*(?:₹|rs\.?|inr)?\s*([0-9][0-9,.]*)\s*(k|thousand|l|lakh|lac)?\b/
  );

  if (!match) {
    return null;
  }

  return toRupees(match[1], match[2]);
}


// =====================================================
// SERPER (LIVE GOOGLE SHOPPING RESULTS)
// =====================================================

function parsePrice(priceText) {
  if (!priceText) {
    return null;
  }

  // The first number, so "Rs. 499" isn't read as ".499" and a range
  // ("₹1,299 - ₹1,499") isn't glued into one number.
  const match = String(priceText).match(/\d[\d,]*(?:\.\d+)?/);
  const number = match ? Number(match[0].replace(/,/g, "")) : Number.NaN;

  return Number.isFinite(number) && number > 0
    ? Math.round(number)
    : null;
}

// endpoint is "shopping" (2 credits), "search" or "images" (1 credit each).
async function serperRequest(endpoint, body) {
  if (!SERPER_API_KEY) {
    throw new Error("SERPER_API_KEY is not set.");
  }

  const request = () =>
    fetch(`https://google.serper.dev/${endpoint}`, {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        gl: "in",
        hl: "en",
        ...body
      }),
      signal: AbortSignal.timeout(8000)
    });

  let response;

  try {
    response = await request();
  } catch (error) {
    // Retry once on network errors (dropped connection or timeout).
    response = await request();
  }

  if (!response.ok) {
    throw new Error(
      `Serper request failed with status ${response.status}`
    );
  }

  return response.json();
}

// "amazon.in" -> "Amazon", "Mi.com" -> "Mi"
function storeName(source) {
  const name = (source || "Online store")
    .trim()
    .replace(/\.(co\.in|in|com)$/i, "");

  return name.charAt(0).toUpperCase() + name.slice(1);
}

async function searchShopping(query) {
  const key = cacheKey("shopping", query);
  const cached = await getCached(key);

  if (cached) {
    return cached;
  }

  const data = await serperRequest("shopping", { q: query });
  const seen = new Set();
  const listings = [];

  for (const item of data.shopping || []) {
    const price = parsePrice(item.price);
    const title = (item.title || "").trim();
    const titleKey = title.toLowerCase();

    if (!title || !price || seen.has(titleKey)) {
      continue;
    }

    seen.add(titleKey);

    listings.push({
      id: item.productId || `${listings.length + 1}-${titleKey}`,
      name: title,
      price,
      priceText: item.price,
      store: storeName(item.source),
      image: item.imageUrl || null,
      rating: item.rating || null,
      reviews: item.ratingCount || null
    });
  }

  await setCached(key, listings);

  return listings;
}


// =====================================================
// GEMINI (PICK AND EXPLAIN)
// =====================================================

// Products page: keeps listings that really are `label` (e.g. "Sofas"),
// dropping covers, parts, accessories and foreign or unknown sellers.
// Falls back to the raw listings if Gemini fails.
async function filterListings(label, listings, limit = PRODUCTS_PER_PAGE) {
  const candidates = listings.slice(0, 40);

  try {
    const response = await generate({
      contents: `
Shoppers in India are browsing: ${label}

Live listings from Google Shopping (prices in INR):
${JSON.stringify(candidates.map((item, index) => ({
  index,
  name: item.name,
  price: item.price,
  store: item.store
})))}

Pick up to ${limit} listings, by index, that a shopper browsing "${label}" wants to see.

Rules:
1. Only the product itself: skip covers, cases, spare parts, accessories,
   and listings for a different kind of product.
2. Skip used, refurbished and wholesale listings, and stores that do not
   sell in India.
3. Prefer well-known Indian retailers and brand stores, good ratings and
   different models (no duplicates of the same model).
4. Order them from the best pick to the least.
`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            indexes: { type: "array", items: { type: "integer" } }
          },
          required: ["indexes"]
        }
      }
    });

    const indexes = JSON.parse(response.text || "{}").indexes || [];
    const picked = [...new Set(indexes)]
      .filter((index) => candidates[index])
      .map((index) => candidates[index])
      .slice(0, limit);

    if (picked.length > 0) {
      return picked;
    }
  } catch (error) {
    console.log("Gemini Error:", error.message);
  }

  return candidates.slice(0, limit);
}

async function pickWithGemini(userQuery, budget, listings) {
  const candidates = listings.map((item, index) => ({
    index,
    name: item.name,
    price: item.price,
    store: item.store,
    rating: item.rating,
    reviews: item.reviews
  }));

  const response = await generate({
    contents: `
You are SmartBuy AI, a shopping assistant for customers in India.

User request:
${userQuery}

${budget ? `Budget: up to ₹${budget}` : "Budget: not specified"}

Live listings from Google Shopping (prices in INR):
${JSON.stringify(candidates)}

Rules:
1. Pick at most 6 listings from the list above, by index. Never invent products.
2. Pick the actual product the user asked for. Skip accessories, cases,
   covers, spare parts and refurbished items unless the user asked for them.
3. Respect the budget.
4. Avoid picking the same model twice. Strongly prefer listings from well-known
   retailers (Amazon, Flipkart, Croma, Reliance Digital, Vijay Sales, Tata CLiQ,
   JioMart, Pepperfry, Urban Ladder, IKEA, Wakefit, Myntra, Ajio, Nykaa,
   Decathlon, official brand stores) and good ratings. Skip used, pre-owned or
   refurbished marketplaces (e.g. Cashify, GameLoot) and unknown small sellers
   unless nothing else matches.
5. For each pick, give a one-sentence reason (max 20 words) a shopper would find useful.
   Do not mention the price or the store in the reason (prices are compared
   across stores afterwards).
6. "reply" is a short friendly message (max 2 sentences) summarising the picks.
7. "category" is the product category the user is shopping for.
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          reply: { type: "string" },
          category: {
            type: "string",
            enum: CATEGORIES
          },
          picks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "integer" },
                reason: { type: "string" }
              },
              required: ["index", "reason"]
            }
          }
        },
        required: ["reply", "category", "picks"]
      }
    }
  });

  const aiData = JSON.parse(response.text || "{}");
  const used = new Set();

  const results = (Array.isArray(aiData.picks) ? aiData.picks : [])
    .filter((pick) => {
      const valid =
        Number.isInteger(pick.index) &&
        listings[pick.index] &&
        !used.has(pick.index);

      used.add(pick.index);
      return valid;
    })
    .slice(0, 6)
    .map((pick) => ({
      ...listings[pick.index],
      reason: pick.reason
    }));

  return {
    reply: aiData.reply,
    category: CATEGORIES.includes(aiData.category)
      ? aiData.category
      : "Other",
    results
  };
}


// =====================================================
// PRICE COMPARISON (DIRECT STORE LINKS)
// =====================================================

// Google web results for one product (1 Serper credit, cached).
async function findStorePages(name) {
  const key = cacheKey("pages", name);
  const cached = await getCached(key);

  if (cached) {
    return cached;
  }

  const data = await serperRequest("search", {
    q: `${name} price`,
    num: 10
  });

  const pages = (data.organic || []).map((item, index) => ({
    index,
    title: item.title,
    url: item.link,
    snippet: item.snippet
  }));

  await setCached(key, pages);

  return pages;
}

// Model codes in a product name, e.g. "fb3124AX" or "FX507VV". A page must
// mention one of them to count as the same product.
function modelCodes(name) {
  return name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(
      (token) =>
        token.length >= 5 && /[a-z]/.test(token) && /[0-9]/.test(token)
    );
}

function mentionsModel(page, codes) {
  if (codes.length === 0) {
    return true;
  }

  // Title and URL only: snippets often mention other models.
  const text = `${page.title} ${page.url}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return codes.some((code) => text.includes(code));
}

// Gemini reads the search results of several products in one call.
// Returns { [itemIndex]: [{ store, price, link }] }. Pages that don't mention
// a product's model code are dropped before Gemini sees them.
async function extractOffersBatch(items) {
  const prepared = items.map((item) => {
    const codes = modelCodes(item.name);

    return {
      name: item.name,
      pages: item.pages.filter((page) => mentionsModel(page, codes))
    };
  });

  const result = {};

  prepared.forEach((item, index) => {
    result[index] = [];
  });

  const withPages = prepared
    .map((item, index) => ({ product: index, name: item.name, results: item.pages }))
    .filter((item) => item.results.length > 0);

  if (withPages.length === 0) {
    return result;
  }

  const response = await generate({
    contents: `
For each product below you get Google search results (India).
Find the pages where that exact product can be bought.

${JSON.stringify(withPages)}

Rules:
1. Only include pages from stores that sell it directly (Amazon, Flipkart,
   Croma, Reliance Digital, Vijay Sales, Tata CLiQ, JioMart, Pepperfry,
   Urban Ladder, IKEA, Wakefit, Myntra, Ajio, Nykaa, Decathlon, brand stores, etc.).
   Skip used, refurbished, open-box or renewed listings and sellers, and
   wholesale/B2B marketplaces (IndiaMART, Tradeindia).
2. Skip price-comparison sites, reviews, news, blogs, and category or listing pages.
3. Only include a page if it is for the same model as that product. A different
   model number, generation or configuration (RAM, storage, size) is NOT the same product.
4. "price" is the current selling price in rupees shown in the snippet
   (deal/offer price, not MRP). Use 0 if the snippet shows no price for this
   model, or if the page covers several variants and the price may be for a
   different configuration (e.g. a "starting from" price).
5. "store" is the store's display name, e.g. "Amazon", "Croma".
6. "page" is the result's index. At most one page per store for each product.
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          products: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product: { type: "integer" },
                offers: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      page: { type: "integer" },
                      store: { type: "string" },
                      price: { type: "integer" }
                    },
                    required: ["page", "store", "price"]
                  }
                }
              },
              required: ["product", "offers"]
            }
          }
        },
        required: ["products"]
      }
    }
  });

  const aiData = JSON.parse(response.text || "{}");
  const done = new Set();

  for (const entry of aiData.products || []) {
    const item = prepared[entry.product];

    if (!item || done.has(entry.product)) {
      continue;
    }

    done.add(entry.product);

    const stores = new Set();

    for (const offer of entry.offers || []) {
      const page = item.pages.find((candidate) => candidate.index === offer.page);
      const store = (offer.store || "").trim();

      if (!page || !store || stores.has(store.toLowerCase())) {
        continue;
      }

      stores.add(store.toLowerCase());

      result[entry.product].push({
        store,
        price: offer.price > 0 ? offer.price : null,
        link: page.url
      });
    }
  }

  return result;
}

// Adds the Google Shopping listing itself as an offer (without its Google
// link), sorts offers by price and picks the lowest.
function mergeOffers(product, offers) {
  const listedStore = product.store.toLowerCase();

  const match = offers.find((offer) => {
    const offerName = offer.store.toLowerCase();
    return offerName.includes(listedStore) || listedStore.includes(offerName);
  });

  let merged = offers;

  if (match && (match.price === null || product.price < match.price)) {
    merged = offers.map((offer) =>
      offer === match ? { ...offer, price: product.price } : offer
    );
  }

  if (!match) {
    merged = [
      ...offers,
      {
        store: product.store,
        price: product.price,
        link: null
      }
    ];
  }

  // With 3+ prices, drop any below half the median: usually an EMI amount,
  // a deposit or a misread snippet rather than a real deal.
  const prices = merged
    .map((offer) => offer.price)
    .filter((price) => price !== null)
    .sort((a, b) => a - b);

  if (prices.length >= 3) {
    const median = prices[Math.floor(prices.length / 2)];

    merged = merged.filter(
      (offer) => offer.price === null || offer.price >= median * 0.5
    );
  }

  return [...merged].sort((a, b) => {
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });
}

// Products not in the cache are compared in this many parallel Gemini calls.
const COMPARE_BATCHES = 2;

// Compares prices for every product and makes the lowest offer its headline
// price and store. Returns { products, complete }; complete is false when a
// lookup failed, so the caller can avoid caching a partial result.
async function compareProducts(products) {
  const names = [...new Set(products.map((product) => product.name))];
  const offersByName = {};
  const pending = [];
  let complete = true;

  await Promise.all(
    names.map(async (name) => {
      const cached = await getCached(cacheKey("offers", name));

      if (cached) {
        offersByName[name] = cached;
      } else {
        pending.push({ name, pages: [] });
      }
    })
  );

  // Web results for each product not cached yet (1 Serper credit each).
  const ready = [];

  await Promise.all(
    pending.map(async (item) => {
      try {
        item.pages = await findStorePages(item.name);
        ready.push(item);
      } catch (error) {
        console.log("Compare Error:", error.message);
        complete = false;
      }
    })
  );

  const batchSize = Math.max(1, Math.ceil(ready.length / COMPARE_BATCHES));
  const batches = [];

  for (let i = 0; i < ready.length; i += batchSize) {
    batches.push(ready.slice(i, i + batchSize));
  }

  await Promise.all(
    batches.map(async (batch) => {
      try {
        const extracted = await extractOffersBatch(batch);

        await Promise.all(
          batch.map(async (item, index) => {
            offersByName[item.name] = extracted[index] || [];
            await setCached(cacheKey("offers", item.name), offersByName[item.name]);
          })
        );
      } catch (error) {
        console.log("Compare Error:", error.message);
        complete = false;
      }
    })
  );

  const compared = products.map((product) => {
    const offers = mergeOffers(product, offersByName[product.name] || []);
    const lowest = offers.find((offer) => offer.price !== null);

    return {
      ...product,
      price: lowest ? lowest.price : product.price,
      store: lowest ? lowest.store : product.store,
      offers
    };
  });

  return { products: compared, complete };
}


// =====================================================
// AI PRODUCT SEARCH
// =====================================================

// Runs one AI search. Returns { status, payload }.
async function runSearch(query) {
  const answerKey = cacheKey("answer", query);
  const cachedAnswer = await getCached(answerKey);

  if (cachedAnswer) {
    return { status: 200, payload: cachedAnswer };
  }

  const budget = extractBudget(query);
  let listings;

  try {
    listings = await searchShopping(query);
  } catch (error) {
    console.log("Serper Error:", error.message);

    return {
      status: 502,
      payload: {
        message: "Unable to fetch live prices right now. Please try again.",
        count: 0,
        results: []
      }
    };
  }

  if (budget) {
    listings = listings.filter((item) => item.price <= budget);
  }

  listings = listings.slice(0, 25);

  if (listings.length === 0) {
    return {
      status: 200,
      payload: {
        message: "Search completed successfully.",
        reply: "I couldn't find live listings for that. Try a different product or budget.",
        category: "Other",
        count: 0,
        results: []
      }
    };
  }

  let answer;

  try {
    answer = await pickWithGemini(query, budget, listings);
  } catch (error) {
    console.log("Gemini Error:", error.message);
  }

  if (!answer || answer.results.length === 0) {
    // Gemini failed or picked nothing: show the top live listings as-is.
    answer = {
      reply: "Here are the top live listings I found.",
      category: answer?.category || "Other",
      results: listings.slice(0, 6)
    };
  }

  const { products: results, complete } = await compareProducts(answer.results);

  const payload = {
    message: "Search completed successfully.",
    reply: answer.reply,
    category: answer.category,
    count: results.length,
    results
  };

  // Don't keep a partial comparison for 6 hours.
  if (complete) {
    await setCached(answerKey, payload);
  }

  return { status: 200, payload };
}

// Signed-in users only: every chat is saved to the user's history.
app.post("/api/search", requireDB, optionalAuth, requireAuth, searchLimiter, async (req, res) => {
  const query =
    typeof req.body.query === "string"
      ? req.body.query.trim()
      : "";

  if (!query) {
    return res.status(400).json({
      message: "Please enter a search query.",
      count: 0,
      results: []
    });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return res.status(400).json({
      message: `Please keep your search under ${MAX_QUERY_LENGTH} characters.`,
      count: 0,
      results: []
    });
  }

  console.log("User Search:", query);

  const { status, payload } = await runSearch(query);

  if (status === 200) {
    await logSearch(query, payload.category, payload.results, req.userId);
  }

  let conversationId;

  try {
    conversationId = await saveExchange(
      req.userId,
      req.body.conversationId,
      query,
      {
        text: status === 200 ? payload.reply : payload.message,
        error: status !== 200,
        products: payload.results
      }
    );
  } catch (error) {
    console.log("Chat Save Error:", error.message);
  }

  res.status(status).json({ ...payload, conversationId });
});


// =====================================================
// BROWSE PRODUCTS (LIVE LISTINGS, NO AI PICKS)
// =====================================================

app.get("/api/products", async (req, res) => {
  const category =
    typeof req.query.category === "string" &&
    Object.hasOwn(CATEGORY_QUERIES, req.query.category)
      ? req.query.category
      : "Smartphones";

  const search =
    typeof req.query.q === "string"
      ? req.query.q.trim().slice(0, MAX_QUERY_LENGTH)
      : "";

  const query = search || CATEGORY_QUERIES[category];
  const pageKey = cacheKey("page", query);
  const cachedPage = await getCached(pageKey);

  if (cachedPage) {
    return res.json(cachedPage);
  }

  try {
    const listings = await searchShopping(query);
    const { products, complete } = await compareProducts(
      await filterListings(search || category, listings)
    );

    const payload = {
      category,
      query,
      count: products.length,
      products
    };

    if (complete) {
      await setCached(pageKey, payload);
    }

    res.json(payload);
  } catch (error) {
    console.log("Serper Error:", error.message);

    res.status(502).json({
      message: "Unable to fetch live products right now.",
      count: 0,
      products: []
    });
  }
});


// =====================================================
// PRODUCT DETAILS PAGE
// =====================================================

// Icons the details page can show next to a key highlight.
const HIGHLIGHT_ICONS = [
  "chip",
  "display",
  "camera",
  "battery",
  "network",
  "os",
  "storage",
  "memory",
  "audio",
  "size",
  "weight",
  "power",
  "material",
  "warranty",
  "other"
];

// Alternatives (similar and cheaper products) shown on the details page.
const ALTERNATIVES_LIMIT = 12;

const USED_LISTING = /\b(refurbished|renewed|pre-?owned|used|open box|unboxed|good condition|fair condition|like new)\b/i;
const USED_STORES = /\b(cashify|gameloot|ovantica|controlz|yaantra|cex|refit|budli)\b/i;

// Well-known Indian retailers and brand stores, preferred for alternatives.
const KNOWN_STORES =
  /\b(amazon|flipkart|croma|reliance|vijay sales|tata ?cliq|jiomart|zepto|blinkit|bigbasket|myntra|ajio|nykaa|pepperfry|ikea|decathlon|urban ?ladder|wakefit|poorvika|sangeetha|samsung|apple|oneplus|mi|xiaomi|vivo|oppo|realme|iqoo|motorola|google|nothing|lenovo|hp|dell|asus|acer|sony|lg|boat|noise)\b/i;

function cleanText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanScore(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(10, Math.max(0, Math.round(value * 10) / 10))
    : null;
}

// Lowercase letters and digits only, for loose name matching.
function normalizeName(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// New products only: no used or refurbished listings and sellers.
function isNewListing(item) {
  return (
    !USED_LISTING.test(item.name) &&
    !USED_STORES.test(item.store)
  );
}

function nameTokens(text) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

// The listing sharing the most words with `name`. Extra words count against
// it, so "iPhone 15" beats "iPhone 15 Pro". Ties keep Google's order.
function closestListing(name, listings) {
  const wanted = new Set(nameTokens(name));
  let best = null;
  let bestScore = -Infinity;

  for (const item of listings) {
    const tokens = nameTokens(item.name);
    const matched = tokens.filter((token) => wanted.has(token)).length;
    const score = matched - (tokens.length - matched) * 0.5;

    if (score > bestScore) {
      best = item;
      bestScore = score;
    }
  }

  return best;
}

// Rebuilds a product from its name, for links opened without chat data
// (shared links, a new tab). Costs the same as a search for that name.
async function lookupProduct(name) {
  const listings = await searchShopping(name);
  const wanted = normalizeName(name);

  const fresh = listings.filter(isNewListing);
  const pool = fresh.length > 0 ? fresh : listings;

  let listing = pool.find((item) => normalizeName(item.name) === wanted);

  // No exact match: Gemini skips accessories and odd sellers, as in a chat.
  if (!listing && pool.length > 0) {
    try {
      const { results } = await pickWithGemini(name, null, pool.slice(0, 25));
      listing = closestListing(name, results);
    } catch (error) {
      console.log("Gemini Error:", error.message);
    }

    listing = listing || closestListing(name, pool);
  }

  if (!listing) {
    return null;
  }

  const { products } = await compareProducts([listing]);

  return products[0];
}

// Google web results about the product's specifications (1 Serper credit, cached).
async function findSpecPages(name) {
  const key = cacheKey("specs", name);
  const cached = await getCached(key);

  if (cached) {
    return cached;
  }

  const data = await serperRequest("search", {
    q: `${name} specifications`,
    num: 10
  });

  const pages = (data.organic || []).map((item) => ({
    title: item.title,
    snippet: item.snippet
  }));

  await setCached(key, pages);

  return pages;
}

// Words that make a different model of the same series ("Galaxy S24 Ultra").
const MODEL_VARIANT_WORDS = ["ultra", "plus", "pro", "max", "mini", "lite", "fe", "neo"];

// Gallery images.
const IMAGES_LIMIT = 6;

// Google Images photos of this product (1 Serper credit, cached). Google
// Shopping gives only one image per listing.
async function findImages(name, info) {
  const key = cacheKey("images", name);
  const cached = await getCached(key);

  if (cached) {
    return cached;
  }

  const data = await serperRequest("images", { q: name, num: 20 });

  const ownTokens = new Set(nameTokens(name));
  const otherModelWords = MODEL_VARIANT_WORDS.filter(
    (word) => !ownTokens.has(word)
  );
  const model = normalizeName(info?.shortName || name);
  const seen = new Set();
  const images = [];

  for (const item of data.images || []) {
    const width = item.imageWidth || 0;
    const height = item.imageHeight || 0;
    const titleTokens = nameTokens(item.title || "");

    // Same model only, from a new-product seller, and a product photo
    // (not a banner or a tiny icon).
    if (
      !String(item.imageUrl).startsWith("https://") ||
      seen.has(item.imageUrl) ||
      !normalizeName(item.title || "").includes(model) ||
      otherModelWords.some((word) => titleTokens.includes(word)) ||
      USED_LISTING.test(item.title || "") ||
      USED_STORES.test(`${item.source} ${item.domain}`) ||
      width < 400 ||
      height < 400 ||
      width / height > 1.6 ||
      height / width > 1.6
    ) {
      continue;
    }

    seen.add(item.imageUrl);
    images.push({
      url: item.imageUrl,
      thumb: String(item.thumbnailUrl).startsWith("https://")
        ? item.thumbnailUrl
        : null
    });

    if (images.length === IMAGES_LIMIT) {
      break;
    }
  }

  await setCached(key, images);

  return images;
}

// Gemini turns the web results into the details page content.
async function describeProduct(name, price, pages) {
  const response = await generate({
    contents: `
You are SmartBuy AI, a shopping assistant for customers in India.

Product: ${name}
${price ? `Current lowest price: ₹${price}` : ""}

Google search results about this product:
${JSON.stringify(pages)}

Describe this exact product (same model, configuration and colour) for a
product details page.

Rules:
1. Use the search results first. You may add well-known facts about this exact
   model, but never guess: leave out anything you are not sure about.
2. "brand" is the brand name, e.g. "Apple". "shortName" is the model without
   brand-only words or configuration, e.g. "iPhone 15".
3. "variant" lists the configuration from the product name, e.g.
   ["128GB", "Pink", "5G"] (max 4 short items, may be empty).
4. "mrp" is the maximum retail price (MRP) in rupees if a search result shows
   it for this configuration, otherwise 0.
5. "summary" is 2-3 sentences on why a shopper would choose this product.
   Do not mention any price, discount or store.
6. "pros" are up to 5 short reasons to buy (max 8 words each).
7. "highlights" are the 4-6 most important features, each with an "icon" from
   the list, a short "title" (e.g. "A16 Bionic") and a short "detail"
   (e.g. "Chip").
8. "specs" groups the specifications (e.g. "Display", "Performance",
   "Camera", "Battery", "General"), max 6 groups and 6 items per group.
9. "featureScore" (0-10) rates the features for this product's price segment.
   "brandScore" (0-10) rates the brand's reliability and after-sales support
   in India.
10. "category" is the product category.
11. "competitors" names 8 competing models sold new in India today: 4 in the
    same price segment (about 85-130% of the price) and 4 good cheaper
    alternatives (about 40-80% of the price). Brand and model only, e.g.
    "Samsung Galaxy S24". Never this product itself or another
    configuration of it.
12. "similarQuery" is a short Google Shopping search (no brand) for this kind
    of product, e.g. "5g smartphone 128gb" or "65 inch 4k smart tv".
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          brand: { type: "string" },
          shortName: { type: "string" },
          variant: { type: "array", items: { type: "string" } },
          mrp: { type: "integer" },
          summary: { type: "string" },
          pros: { type: "array", items: { type: "string" } },
          highlights: {
            type: "array",
            items: {
              type: "object",
              properties: {
                icon: { type: "string", enum: HIGHLIGHT_ICONS },
                title: { type: "string" },
                detail: { type: "string" }
              },
              required: ["icon", "title", "detail"]
            }
          },
          specs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                group: { type: "string" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" }
                    },
                    required: ["label", "value"]
                  }
                }
              },
              required: ["group", "items"]
            }
          },
          featureScore: { type: "number" },
          brandScore: { type: "number" },
          category: { type: "string", enum: CATEGORIES },
          competitors: { type: "array", items: { type: "string" } },
          similarQuery: { type: "string" }
        },
        required: [
          "brand",
          "shortName",
          "variant",
          "mrp",
          "summary",
          "pros",
          "highlights",
          "specs",
          "featureScore",
          "brandScore",
          "category",
          "competitors",
          "similarQuery"
        ]
      }
    }
  });

  const aiData = JSON.parse(response.text || "{}");
  const list = (value) => (Array.isArray(value) ? value : []);

  return {
    brand: cleanText(aiData.brand, 40),
    shortName: cleanText(aiData.shortName, 80),
    variant: list(aiData.variant)
      .map((item) => cleanText(item, 24))
      .filter(Boolean)
      .slice(0, 4),
    mrp: Number.isInteger(aiData.mrp) && aiData.mrp > 0 ? aiData.mrp : null,
    summary: cleanText(aiData.summary, 600),
    pros: list(aiData.pros)
      .map((item) => cleanText(item, 80))
      .filter(Boolean)
      .slice(0, 5),
    highlights: list(aiData.highlights)
      .map((item) => ({
        icon: HIGHLIGHT_ICONS.includes(item.icon) ? item.icon : "other",
        title: cleanText(item.title, 40),
        detail: cleanText(item.detail, 40)
      }))
      .filter((item) => item.title)
      .slice(0, 6),
    specs: list(aiData.specs)
      .map((group) => ({
        group: cleanText(group.group, 40),
        items: list(group.items)
          .map((item) => ({
            label: cleanText(item.label, 40),
            value: cleanText(item.value, 120)
          }))
          .filter((item) => item.label && item.value)
          .slice(0, 6)
      }))
      .filter((group) => group.group && group.items.length > 0)
      .slice(0, 6),
    featureScore: cleanScore(aiData.featureScore),
    brandScore: cleanScore(aiData.brandScore),
    category: CATEGORIES.includes(aiData.category) ? aiData.category : "Other",
    competitors: list(aiData.competitors)
      .map((item) => cleanText(item, 60))
      .filter(Boolean)
      .slice(0, 8),
    similarQuery: cleanText(aiData.similarQuery, 100)
  };
}

// Competing listings of the same type. The page splits them into similar
// (close in price) and cheaper alternatives.
async function findAlternatives(name, price, info) {
  const codes = modelCodes(name);
  const ownName = normalizeName(info.shortName || name);

  // New listings of other models. With a known price, only 30-130% of it:
  // far cheaper listings are usually covers and accessories.
  const usable = (item) =>
    isNewListing(item) &&
    !normalizeName(item.name).includes(ownName) &&
    !(codes.length > 0 && mentionsModel({ title: item.name, url: "" }, codes)) &&
    !(price && (item.price < price * 0.3 || item.price > price * 1.3));

  // The listing that really is `model` (2 Serper credits), preferring
  // well-known stores. Named models keep the price segment; a generic search
  // mostly returns budget models.
  const findModel = async (model) => {
    try {
      const modelName = normalizeName(model);
      const withoutBrand = normalizeName(model.split(/\s+/).slice(1).join(" "));
      const modelTokens = new Set(nameTokens(model));
      const otherModelWords = MODEL_VARIANT_WORDS.filter(
        (word) => !modelTokens.has(word)
      );

      const matching = (await searchShopping(model)).filter((item) => {
        const itemName = normalizeName(item.name);
        const itemTokens = nameTokens(item.name);

        return (
          usable(item) &&
          (itemName.includes(modelName) ||
            (withoutBrand.length >= 4 && itemName.includes(withoutBrand))) &&
          !otherModelWords.some((word) => itemTokens.includes(word))
        );
      });

      const known = matching.filter((item) => KNOWN_STORES.test(item.store));

      return closestListing(model, known.length > 0 ? known : matching);
    } catch (error) {
      console.log("Details Error:", error.message);
      return null;
    }
  };

  const seen = new Set();
  const alternatives = [];

  const add = (item) => {
    const key = normalizeName(item?.name || "");

    if (key && !seen.has(key)) {
      seen.add(key);
      alternatives.push(item);
    }
  };

  (await Promise.all(info.competitors.map(findModel))).forEach(add);

  // Gemini picks competitors by launch price, but older models often sell
  // far cheaper now. With few at this price, it names more using the real
  // prices found.
  const similarCount = () =>
    alternatives.filter((item) => item.price >= price * 0.85).length;

  if (price && similarCount() < 3) {
    try {
      const more = await moreSimilarModels(name, price, info, alternatives);
      (await Promise.all(more.map(findModel))).forEach(add);
    } catch (error) {
      console.log("Gemini Error:", error.message);
    }
  }

  // Fewer than expected (models not sold any more, unusual names): the
  // generic search for this kind of product fills the gap.
  if (alternatives.length < ALTERNATIVES_LIMIT && info.similarQuery) {
    const others = (await searchShopping(info.similarQuery)).filter(
      (item) => usable(item) && !seen.has(normalizeName(item.name))
    );

    if (others.length > 0) {
      const label =
        info.category !== "Other" ? info.category : info.similarQuery;

      (
        await filterListings(
          label,
          others,
          ALTERNATIVES_LIMIT - alternatives.length
        )
      ).forEach(add);
    }
  }

  return alternatives.slice(0, ALTERNATIVES_LIMIT + 8);
}

// Models selling at about this product's price, told the real prices of the
// competitors found so far.
async function moreSimilarModels(name, price, info, found) {
  const low = Math.round(price * 0.85);
  const high = Math.round(price * 1.3);

  const response = await generate({
    contents: `
Product: ${name}
Current lowest price in India: ₹${price}

Competing models already found, with their current prices in India:
${JSON.stringify(found.map((item) => ({ name: item.name, price: item.price })))}

Most of them now sell for less than this product. Name 5 other models of the
same kind that are sold new in India today for about ₹${low} to ₹${high}.
Prefer the newest generation on sale. Brand and model only, e.g.
"Samsung Galaxy S25". Do not repeat this product, another configuration of it,
or any model above.
`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          models: { type: "array", items: { type: "string" } }
        },
        required: ["models"]
      }
    }
  });

  const named = new Set(info.competitors.map(normalizeName));

  return (JSON.parse(response.text || "{}").models || [])
    .map((model) => cleanText(model, 60))
    .filter((model) => model && !named.has(normalizeName(model)))
    .slice(0, 5);
}

// Specs, highlights, scores and alternatives for one product, cached like
// search results. About 20 Serper credits and 2-3 Gemini calls when not cached.
// price (the lowest store price) sets the segment for the alternatives.
async function getProductDetails(name, price) {
  // Alternatives depend on the price, so a big price change refreshes them.
  const key = cacheKey(
    "details-v5",
    price ? `${name} @${Math.round(price / 5000)}` : name
  );
  const cached = await getCached(key);

  if (cached) {
    return cached;
  }

  let complete = true;
  let pages = [];

  try {
    pages = await findSpecPages(name);
  } catch (error) {
    console.log("Details Error:", error.message);
    complete = false;
  }

  let info = null;

  try {
    info = await describeProduct(name, price, pages);
  } catch (error) {
    console.log("Gemini Error:", error.message);
    complete = false;
  }

  let alternatives = [];

  if (info?.competitors.length > 0 || info?.similarQuery) {
    try {
      alternatives = await findAlternatives(name, price, info);
    } catch (error) {
      console.log("Details Error:", error.message);
      complete = false;
    }
  }

  let images = [];

  try {
    images = await findImages(name, info);
  } catch (error) {
    console.log("Details Error:", error.message);
    complete = false;
  }

  const details = { ...info, images, alternatives, available: Boolean(info) };

  // Don't keep a partial page for 6 hours.
  if (complete && info) {
    await setCached(key, details);
  }

  return details;
}

function readProductName(req, res) {
  const name =
    typeof req.query.name === "string" ? req.query.name.trim() : "";

  if (!name || name.length > MAX_QUERY_LENGTH) {
    res.status(400).json({ message: "Please choose a product." });
    return null;
  }

  return name;
}

// The product itself (price and store offers), for links opened without
// chat data.
app.get("/api/product", optionalAuth, searchLimiter, async (req, res) => {
  const name = readProductName(req, res);

  if (!name) return;

  try {
    const product = await lookupProduct(name);

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    res.json({ product });
  } catch (error) {
    console.log("Serper Error:", error.message);

    res.status(502).json({
      message: "Unable to fetch live prices right now. Please try again."
    });
  }
});

app.get("/api/product/details", optionalAuth, searchLimiter, async (req, res) => {
  const name = readProductName(req, res);

  if (!name) return;

  const price = Number(req.query.price);

  res.json(
    await getProductDetails(
      name,
      Number.isInteger(price) && price > 0 && price < 100000000 ? price : null
    )
  );
});


// =====================================================
// ADMIN STATISTICS
// =====================================================

async function getSerperCredits() {
  if (!SERPER_API_KEY) {
    return null;
  }

  try {
    const response = await fetch(
      "https://google.serper.dev/account",
      {
        headers: { "X-API-KEY": SERPER_API_KEY }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    return typeof data.balance === "number"
      ? data.balance
      : null;
  } catch (error) {
    return null;
  }
}

// Searches per day for the last `days` days (India time), oldest first,
// including days with no searches.
async function searchesPerDay(days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const rows = await SearchLog.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Asia/Kolkata"
          }
        },
        count: { $sum: 1 }
      }
    }
  ]);

  const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));
  const format = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

  return Array.from({ length: days }, (_, index) => {
    const date = format.format(
      new Date(Date.now() - (days - 1 - index) * 24 * 60 * 60 * 1000)
    );

    return { date, count: counts[date] || 0 };
  });
}

// Admins only (role checked in the database on every request).
app.get("/api/admin/stats", requireDB, optionalAuth, requireAuth, requireAdmin, async (req, res) => {
  // Category and product stats cover the most recent searches.
  const [logs, totalSearches, users, chats, perDay, credits] = await Promise.all([
    SearchLog.find().sort({ createdAt: -1 }).limit(1000).lean(),
    SearchLog.estimatedDocumentCount(),
    User.estimatedDocumentCount(),
    Conversation.estimatedDocumentCount(),
    searchesPerDay(7),
    getSerperCredits()
  ]);

  const categoryCounts = {};
  const productCounts = {};

  logs.forEach((item) => {
    if (item.category) {
      categoryCounts[item.category] =
        (categoryCounts[item.category] || 0) + 1;
    }

    (item.products || []).forEach((name) => {
      productCounts[name] = (productCounts[name] || 0) + 1;
    });
  });

  const categories = Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  const productsData = Object.entries(productCounts)
    .map(([product, count]) => ({ product, count }))
    .sort((a, b) => b.count - a.count);

  const toRow = (item) => ({
    query: item.query,
    category: item.category,
    results: item.results,
    time: item.createdAt
  });

  res.json({
    totalSearches,
    searchesLast7Days: perDay.reduce((sum, day) => sum + day.count, 0),
    searchesPerDay: perDay,
    users,
    chats,
    categories,
    mostSearched: categories[0] || null,
    mostSearchedProduct: productsData[0] || null,
    products: productsData,
    // Searches that found nothing: gaps worth looking at.
    zeroResultSearches: logs
      .filter((item) => item.results === 0)
      .slice(0, 10)
      .map(toRow),
    recentSearches: logs.slice(0, 20).map(toRow),
    serperCredits: credits
  });
});


// =====================================================
// ERRORS
// =====================================================

// Express needs all four arguments to treat this as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid request body." });
  }

  console.log("Server Error:", error.message);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});


// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  app,
  GEMINI_MODEL,
  liveStatus: SERPER_API_KEY ? "Serper enabled" : "SERPER_API_KEY missing",
  cacheMode,
  // Internals, exported for the white-box tests.
  internals: {
    CATEGORIES,
    generate,
    toRupees,
    extractBudget,
    parsePrice,
    serperRequest,
    storeName,
    searchShopping,
    filterListings,
    pickWithGemini,
    findStorePages,
    modelCodes,
    mentionsModel,
    extractOffersBatch,
    mergeOffers,
    compareProducts,
    runSearch,
    cleanText,
    cleanScore,
    normalizeName,
    isNewListing,
    nameTokens,
    closestListing,
    lookupProduct,
    findImages,
    describeProduct,
    findAlternatives,
    getProductDetails
  }
};
