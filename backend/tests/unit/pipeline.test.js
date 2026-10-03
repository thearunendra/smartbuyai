// AI search pipeline: Gemini picks, listing filter, offer extraction, price
// comparison and runSearch's paths. Serper and Gemini are mocked.

const { internals } = require("../../app");
const {
  mockSerper,
  geminiReply,
  geminiFails,
  generateContent,
  shoppingItem,
  unique
} = require("../helpers");

const {
  pickWithGemini,
  filterListings,
  extractOffersBatch,
  compareProducts,
  runSearch
} = internals;

const listings = [
  { id: "a", name: "Phone A", price: 10000, store: "Amazon", rating: 4.5, reviews: 100 },
  { id: "b", name: "Phone B", price: 12000, store: "Flipkart", rating: 4.1, reviews: 50 },
  { id: "c", name: "Phone C Case", price: 300, store: "Amazon", rating: null, reviews: null }
];

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("pickWithGemini", () => {
  test("keeps valid, unique picks in Gemini's order with their reasons", async () => {
    geminiReply({
      reply: "Two good phones.",
      category: "Smartphones",
      picks: [
        { index: 1, reason: "Big battery" },
        { index: 1, reason: "Duplicate" },
        { index: 9, reason: "Out of range" },
        { index: "0", reason: "Not a number" },
        { index: 0, reason: "Great camera" }
      ]
    });

    const answer = await pickWithGemini("phone under 20000", 20000, listings);

    expect(answer.reply).toBe("Two good phones.");
    expect(answer.category).toBe("Smartphones");
    expect(answer.results).toEqual([
      { ...listings[1], reason: "Big battery" },
      { ...listings[0], reason: "Great camera" }
    ]);
    expect(generateContent.mock.calls[0][0].contents).toContain(
      "Budget: up to ₹20000"
    );
  });

  test("an unknown category becomes Other and no budget is stated", async () => {
    geminiReply({ reply: "", category: "Rockets", picks: [] });

    const answer = await pickWithGemini("phone", null, listings);

    expect(answer.category).toBe("Other");
    expect(answer.results).toEqual([]);
    expect(generateContent.mock.calls[0][0].contents).toContain(
      "Budget: not specified"
    );
  });

  test("an empty reply gives no picks", async () => {
    generateContent.mockResolvedValueOnce({ text: "" });

    const answer = await pickWithGemini("phone", null, listings);

    expect(answer.results).toEqual([]);
  });
});

describe("filterListings", () => {
  test("keeps Gemini's indexes in order, without duplicates or bad indexes", async () => {
    geminiReply({ indexes: [2, 2, 0, 99] });

    await expect(filterListings("Phones", listings)).resolves.toEqual([
      listings[2],
      listings[0]
    ]);
  });

  test("respects the limit", async () => {
    geminiReply({ indexes: [1, 0, 2] });

    await expect(filterListings("Phones", listings, 1)).resolves.toEqual([
      listings[1]
    ]);
  });

  test("falls back to the listings when Gemini picks nothing", async () => {
    geminiReply({ indexes: [] });

    await expect(filterListings("Phones", listings)).resolves.toEqual(listings);
  });

  test("falls back to the listings when Gemini fails", async () => {
    geminiFails();

    await expect(filterListings("Phones", listings, 2)).resolves.toEqual(
      listings.slice(0, 2)
    );
  });
});

describe("extractOffersBatch", () => {
  const items = [
    {
      name: "ASUS TUF FX507VV",
      pages: [
        { index: 0, title: "ASUS TUF FX507VV", url: "https://amazon.in/fx", snippet: "" },
        { index: 1, title: "ASUS TUF FA506NC", url: "https://flipkart.com/fa", snippet: "" }
      ]
    },
    { name: "Plain Speaker", pages: [] }
  ];

  test("keeps one offer per store on pages that mention the model", async () => {
    geminiReply({
      products: [
        {
          product: 0,
          offers: [
            { page: 0, store: "Amazon", price: 5000 },
            { page: 0, store: "amazon", price: 4000 },
            { page: 1, store: "Flipkart", price: 1 },
            { page: 0, store: "  ", price: 1 }
          ]
        },
        { product: 0, offers: [{ page: 0, store: "Croma", price: 1 }] },
        { product: 7, offers: [{ page: 0, store: "Ghost", price: 1 }] }
      ]
    });

    const result = await extractOffersBatch(items);

    expect(result).toEqual({
      0: [{ store: "Amazon", price: 5000, link: "https://amazon.in/fx" }],
      1: []
    });

    // The page for a different model is never sent to Gemini.
    expect(generateContent.mock.calls[0][0].contents).not.toContain("FA506NC");
  });

  test("a price of 0 means the price is unknown", async () => {
    geminiReply({
      products: [{ product: 0, offers: [{ page: 3, store: "Croma", price: 0 }] }]
    });

    const result = await extractOffersBatch([
      { name: "Plain Speaker", pages: [{ index: 3, title: "Speaker", url: "https://croma.com/s" }] }
    ]);

    expect(result[0]).toEqual([
      { store: "Croma", price: null, link: "https://croma.com/s" }
    ]);
  });

  test("doesn't call Gemini when no product has pages", async () => {
    const result = await extractOffersBatch([{ name: "Plain Speaker", pages: [] }]);

    expect(result).toEqual({ 0: [] });
    expect(generateContent).not.toHaveBeenCalled();
  });

  test("an empty reply gives no offers", async () => {
    generateContent.mockResolvedValueOnce({ text: "" });

    const result = await extractOffersBatch([
      { name: "Plain Speaker", pages: [{ index: 0, title: "a", url: "u" }] }
    ]);

    expect(result).toEqual({ 0: [] });
  });
});

describe("compareProducts", () => {
  test("uses the lowest store offer and caches the offers", async () => {
    const fetchMock = mockSerper(() => ({
      organic: [
        { title: "Compare Speaker One", link: "https://flipkart.com/s1", snippet: "₹900" }
      ]
    }));

    geminiReply({
      products: [{ product: 0, offers: [{ page: 0, store: "Flipkart", price: 900 }] }]
    });

    const product = { name: "Compare Speaker One", price: 1000, store: "Amazon" };
    const first = await compareProducts([product, { ...product }]);

    expect(first.complete).toBe(true);
    expect(first.products[0]).toEqual({
      ...product,
      price: 900,
      store: "Flipkart",
      offers: [
        { store: "Flipkart", price: 900, link: "https://flipkart.com/s1" },
        { store: "Amazon", price: 1000, link: null }
      ]
    });
    // Duplicate names are looked up once.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await compareProducts([product]);

    expect(second.products[0].price).toBe(900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  test("a failed web search marks the result incomplete", async () => {
    mockSerper(() => new Error("timeout"));

    const product = { name: "Compare Speaker Two", price: 1000, store: "Amazon" };
    const result = await compareProducts([product]);

    expect(result.complete).toBe(false);
    expect(result.products[0]).toEqual({
      ...product,
      offers: [{ store: "Amazon", price: 1000, link: null }]
    });
  });

  test("a failed Gemini call marks it incomplete and caches nothing", async () => {
    mockSerper(() => ({
      organic: [{ title: "Compare Speaker Three", link: "https://croma.com/s3" }]
    }));
    geminiFails();

    const product = { name: "Compare Speaker Three", price: 1000, store: "Amazon" };
    const result = await compareProducts([product]);

    expect(result.complete).toBe(false);
    expect(result.products[0].offers).toEqual([
      { store: "Amazon", price: 1000, link: null }
    ]);

    // Nothing was cached, so the next comparison asks Gemini again.
    geminiReply({ products: [] });
    await compareProducts([product]);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test("an offer with no price leaves the listing price in place", async () => {
    mockSerper(() => ({
      organic: [{ title: "Compare Speaker Four", link: "https://croma.com/s4" }]
    }));
    geminiReply({
      products: [{ product: 0, offers: [{ page: 0, store: "Croma", price: 0 }] }]
    });

    const product = { name: "Compare Speaker Four", price: 1000, store: "Amazon" };
    const result = await compareProducts([product]);

    expect(result.products[0].price).toBe(1000);
    expect(result.products[0].store).toBe("Amazon");
  });
});

describe("runSearch", () => {
  // Shopping returns `items`; web searches return nothing, so comparing
  // prices needs no Gemini call.
  function serper(items) {
    return mockSerper((endpoint) =>
      endpoint === "shopping" ? { shopping: items } : { organic: [] }
    );
  }

  const phones = Array.from({ length: 8 }, (_, index) =>
    shoppingItem(`Run Phone ${index + 1}`, 10000 + index * 1000)
  );

  test("returns 502 when live prices can't be fetched", async () => {
    mockSerper(() => new Error("down"));

    const result = await runSearch(unique("phone"));

    expect(result.status).toBe(502);
    expect(result.payload.message).toMatch(/Unable to fetch live prices/);
  });

  test("tells the user when nothing fits the budget", async () => {
    serper(phones);

    const result = await runSearch(unique("phone under 500"));

    expect(result.status).toBe(200);
    expect(result.payload.count).toBe(0);
    expect(result.payload.reply).toMatch(/couldn't find live listings/);
    expect(generateContent).not.toHaveBeenCalled();
  });

  test("shows the top 6 listings when Gemini fails", async () => {
    serper(phones);
    geminiFails();

    const result = await runSearch(unique("phone"));

    expect(result.payload.reply).toBe("Here are the top live listings I found.");
    expect(result.payload.category).toBe("Other");
    expect(result.payload.results.map((item) => item.name)).toEqual(
      phones.slice(0, 6).map((item) => item.title)
    );
  });

  test("keeps Gemini's category when it picks nothing", async () => {
    serper(phones);
    geminiReply({ reply: "None", category: "Laptops", picks: [] });

    const result = await runSearch(unique("laptop"));

    expect(result.payload.category).toBe("Laptops");
    expect(result.payload.count).toBe(6);
  });

  test("returns Gemini's picks and caches a complete answer", async () => {
    const fetchMock = serper(phones);
    const query = unique("phone under 12000");

    geminiReply({
      reply: "Here you go.",
      category: "Smartphones",
      picks: [{ index: 1, reason: "Best value" }]
    });

    const first = await runSearch(query);

    expect(first.status).toBe(200);
    expect(first.payload).toMatchObject({
      reply: "Here you go.",
      category: "Smartphones",
      count: 1
    });
    // Budget 12000 keeps the first three listings; index 1 is Run Phone 2.
    expect(first.payload.results[0]).toMatchObject({
      name: "Run Phone 2",
      reason: "Best value"
    });

    const calls = fetchMock.mock.calls.length;
    const second = await runSearch(query);

    expect(second).toEqual(first);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  test("doesn't cache an answer with a failed price comparison", async () => {
    // Products no other test has compared, so no offers are cached.
    const fresh = [shoppingItem("Uncompared Phone", 15000)];

    mockSerper((endpoint) =>
      endpoint === "shopping" ? { shopping: fresh } : new Error("timeout")
    );

    const query = unique("phone");

    geminiReply({ reply: "r", category: "Smartphones", picks: [{ index: 0, reason: "x" }] });
    await runSearch(query);

    geminiReply({ reply: "r", category: "Smartphones", picks: [{ index: 0, reason: "x" }] });
    await runSearch(query);

    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
