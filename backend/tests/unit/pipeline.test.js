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
  trustedStoreFromUrl,
  extractOffersBatch,
  compareProducts,
  runSearch,
  findExplicitProductCategories,
  detectSearchIntents
} = internals;

const listings = [
  { id: "a", name: "Phone A", price: 10000, store: "Amazon", rating: 4.5, reviews: 100 },
  { id: "b", name: "Phone B", price: 12000, store: "Flipkart", rating: 4.1, reviews: 50 },
  { id: "c", name: "Phone C Case", price: 300, store: "Amazon", rating: null, reviews: null }
];

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("multi-category intent planner", () => {
  test("maps chair, mobile, drone and fridge to the correct catalogue types", () => {
    expect(findExplicitProductCategories(
      "show me chair, mobile, drone and fridge under 50000"
    )).toEqual([
      "Office Chairs",
      "Smartphones",
      "Drones",
      "Refrigerators"
    ]);
  });

  test("does not split a product feature into a second product search", () => {
    expect(findExplicitProductCategories(
      "show me a phone with a good camera and 5G"
    )).toEqual(["Smartphones"]);
  });

  test("recognizes ten distinct product types from one natural-language request", () => {
    const query = [
      "show me chair, mobile, drone, fridge, sofa, laptop, tv,",
      "headphones, smartwatch and mixer grinder under 50000"
    ].join(" ");

    expect(findExplicitProductCategories(query)).toEqual([
      "Office Chairs",
      "Smartphones",
      "Drones",
      "Refrigerators",
      "Sofas",
      "Laptops",
      "Televisions",
      "Headphones",
      "Smartwatches",
      "Mixer Grinders"
    ]);
  });

  test("does not lose explicit categories when Gemini returns only a partial intent list", async () => {
    const query = unique(
      "show me chair, mobile, drone and fridge under 50000"
    );

    geminiReply({
      budgetScope: "per_product",
      intents: [
        { category: "Smartphones", query: "best 5g smartphone" },
        { category: "Drones", query: "best camera drone" }
      ]
    });

    const intents = await detectSearchIntents(query);

    expect(intents.map((intent) => intent.category)).toEqual([
      "Office Chairs",
      "Smartphones",
      "Drones",
      "Refrigerators"
    ]);
    expect(intents.find((intent) => intent.category === "Office Chairs").query)
      .toMatch(/office chair/i);
    expect(intents.find((intent) => intent.category === "Refrigerators").query)
      .toMatch(/refrigerator/i);
  });
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

describe("trustedStoreFromUrl", () => {
  test.each([
    ["https://www.amazon.in/product", "Amazon"],
    ["https://www.flipkart.com/product", "Flipkart"],
    ["https://store.croma.com/product", "Croma"],
    ["https://amazon.in.attacker.example/product", null],
    ["http://amazon.in/product", null],
    ["javascript:alert(1)", null],
    ["not a URL", null]
  ])("%s -> %s", (url, expected) => {
    expect(trustedStoreFromUrl(url)).toBe(expected);
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

  test("rejects unknown and lookalike merchant domains", async () => {
    const result = await extractOffersBatch([
      {
        name: "Plain Speaker",
        pages: [
          { index: 0, title: "Speaker", url: "https://unknown-store.example/item" },
          { index: 1, title: "Speaker", url: "https://amazon.in.attacker.example/item" },
          { index: 2, title: "Speaker", url: "http://flipkart.com/item" }
        ]
      }
    ]);

    expect(result).toEqual({ 0: [] });
    expect(generateContent).not.toHaveBeenCalled();
  });

  test("an empty reply gives no offers", async () => {
    generateContent.mockResolvedValueOnce({ text: "" });

    const result = await extractOffersBatch([
      { name: "Plain Speaker", pages: [{ index: 0, title: "a", url: "https://amazon.in/item" }] }
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

  test("a failed Gemini extraction falls back to exact trusted retailer pages", async () => {
    mockSerper(() => ({
      organic: [{
        title: "Compare Speaker Three",
        link: "https://www.croma.com/s3",
        snippet: "Compare Speaker Three"
      }]
    }));
    geminiFails();

    const product = { name: "Compare Speaker Three", price: 1000, store: "Amazon" };
    const result = await compareProducts([product]);

    expect(result.complete).toBe(true);
    expect(result.products[0].offers).toEqual([
      { store: "Amazon", price: 1000, link: null },
      { store: "Croma", price: null, link: "https://www.croma.com/s3" }
    ]);

    // The deterministic fallback is cached, so a second comparison is served
    // without another Gemini extraction attempt.
    await compareProducts([product]);
    expect(generateContent).toHaveBeenCalledTimes(3);
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

  test("searches requested product types separately and combines their recommendations", async () => {
    const droneListings = [shoppingItem("Test 4K Camera Drone", 12000)];
    const tvListings = [shoppingItem("Test 4K Smart Television", 28000)];

    const fetchMock = mockSerper((endpoint, body) => {
      if (endpoint === "shopping") {
        if (/drone/i.test(body.q)) return { shopping: droneListings };
        if (/tv|television/i.test(body.q)) return { shopping: tvListings };
      }

      return { organic: [] };
    });

    const query = unique("show me drone and tv");

    geminiReply({
      intents: [
        { category: "Drones", query: "best camera drone" },
        { category: "Televisions", query: "best 4k smart tv" }
      ]
    });
    geminiReply({
      reply: "Here are some drone options.",
      category: "Drones",
      picks: [{ index: 0, reason: "A useful camera drone." }]
    });
    geminiReply({
      reply: "Here are some television options.",
      category: "Televisions",
      picks: [{ index: 0, reason: "A clear 4K screen." }]
    });

    const result = await runSearch(query);

    expect(result.status).toBe(200);
    expect(result.payload.categories).toEqual(["Drones", "Televisions"]);
    expect(result.payload.count).toBe(2);
    expect(result.payload.results.map((item) => item.name)).toEqual([
      "Test 4K Camera Drone",
      "Test 4K Smart Television"
    ]);
    expect(result.payload.results.map((item) => item.category)).toEqual([
      "Drones",
      "Televisions"
    ]);

    const shoppingQueries = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/shopping"))
      .map(([, options]) => JSON.parse(options.body).q);

    expect(shoppingQueries).toEqual(
      expect.arrayContaining(["best camera drone", "best 4k smart tv"])
    );
  });

  test("searches four explicitly requested categories even when Gemini omits or misclassifies one", async () => {
    const laptopListings = [
      shoppingItem("ASUS Vivobook 15 Laptop", 65000),
      shoppingItem("Lenovo Idea Tab Pro Gen 2 Tablet", 30000)
    ];
    const phoneListings = [shoppingItem("Samsung Galaxy S25 5G Smartphone", 80000)];
    const droneListings = [shoppingItem("DJI Mini 4K Drone", 55000)];
    const tvListings = [shoppingItem("Sony Bravia 55 inch 4K Smart TV", 90000)];

    const fetchMock = mockSerper((endpoint, body) => {
      if (endpoint === "shopping") {
        if (/laptop/i.test(body.q)) return { shopping: laptopListings };
        if (/smartphone/i.test(body.q)) return { shopping: phoneListings };
        if (/drone/i.test(body.q)) return { shopping: droneListings };
        if (/smart tv/i.test(body.q)) return { shopping: tvListings };
      }

      return { organic: [] };
    });

    const query = unique("show me laptop, mobile, drone and tv under 100000");

    // Simulate the model's old failure: it returns three intents and mistakes
    // mobile for Tablets. Explicit terms must remain authoritative.
    geminiReply({
      budgetScope: "ambiguous",
      intents: [
        { category: "Laptops", query: "best laptop" },
        { category: "Tablets", query: "best tablet" },
        { category: "Drones", query: "best camera drone four category regression" }
      ]
    });
    geminiReply({
      reply: "Laptop options.",
      category: "Laptops",
      picks: [{ index: 0, reason: "A capable everyday laptop." }]
    });
    geminiReply({
      reply: "Phone options.",
      category: "Smartphones",
      picks: [{ index: 0, reason: "A balanced smartphone." }]
    });
    geminiReply({
      reply: "Drone options.",
      category: "Drones",
      picks: [{ index: 0, reason: "A compact camera drone." }]
    });
    geminiReply({
      reply: "Television options.",
      category: "Televisions",
      picks: [{ index: 0, reason: "A large 4K television." }]
    });

    const result = await runSearch(query);

    expect(result.status).toBe(200);
    expect(result.payload.categories).toEqual([
      "Laptops",
      "Smartphones",
      "Drones",
      "Televisions"
    ]);
    expect(result.payload.count).toBe(4);
    expect(result.payload.results.map((item) => item.category)).toEqual([
      "Laptops",
      "Smartphones",
      "Drones",
      "Televisions"
    ]);
    expect(result.payload.results.map((item) => item.name)).toEqual([
      "ASUS Vivobook 15 Laptop",
      "Samsung Galaxy S25 5G Smartphone",
      "DJI Mini 4K Drone",
      "Sony Bravia 55 inch 4K Smart TV"
    ]);
    expect(result.payload.results.every((item) => item.price <= 100000)).toBe(true);
    expect(result.payload.results.some((item) => /Idea Tab/i.test(item.name))).toBe(false);

    const shoppingQueries = fetchMock.mock.calls
      .filter(([url]) => String(url).endsWith("/shopping"))
      .map(([, options]) => JSON.parse(options.body).q);

    expect(shoppingQueries).toEqual(expect.arrayContaining([
      "best laptop",
      "best 5g smartphone",
      "best camera drone four category regression",
      "best smart tv 4k"
    ]));
  });

  test("runs ten requested product searches and returns results for every category", async () => {
    const tag = unique("ten-category");
    const catalogue = [
      ["Office Chairs", "best ergonomic office chair", "Featherlite Ergonomic Office Chair"],
      ["Smartphones", "best 5g smartphone", "Samsung Galaxy A55 5G Smartphone"],
      ["Drones", "best camera drone", "DJI Mini 4K Camera Drone"],
      ["Refrigerators", "best refrigerator", "Samsung Double Door Refrigerator"],
      ["Sofas", "best 3 seater sofa", "Wakefit 3 Seater Sofa"],
      ["Laptops", "best laptop", "ASUS Vivobook 15 Laptop"],
      ["Televisions", "best smart tv 4k", "Sony Bravia 4K Smart TV"],
      ["Headphones", "best over ear headphones", "Sony Wireless Headphones"],
      ["Smartwatches", "best smartwatch", "Noise ColorFit Smartwatch"],
      ["Mixer Grinders", "best mixer grinder", "Preethi Zodiac Mixer Grinder"]
    ].map(([category, query, name], index) => ({
      category,
      query: query + " " + tag,
      product: shoppingItem(name + " " + tag, 12000 + index * 1000)
    }));

    const fetchMock = mockSerper((endpoint, body) => {
      if (endpoint !== "shopping") return { organic: [] };
      const match = catalogue.find((item) => body.q === item.query);
      return { shopping: match ? [match.product] : [] };
    });

    const query = unique(
      "show me chair, mobile, drone, fridge, sofa, laptop, tv, headphones, smartwatch and mixer grinder under 50000"
    );

    geminiReply({
      budgetScope: "per_product",
      intents: catalogue.map((item) => ({
        category: item.category,
        query: item.query
      }))
    });

    for (let index = 0; index < catalogue.length; index += 1) {
      geminiReply({
        reply: "Here is a suitable option.",
        category: catalogue[index].category,
        picks: [{ index: 0, reason: "A suitable option within your budget." }]
      });
    }

    const result = await runSearch(query);

    expect(result.status).toBe(200);
    expect(result.payload.categories).toEqual(catalogue.map((item) => item.category));
    expect(result.payload.missingCategories).toEqual([]);
    expect(result.payload.count).toBe(10);
    expect(result.payload.results.map((item) => item.category)).toEqual(
      catalogue.map((item) => item.category)
    );
    expect(result.payload.results.every((item) => item.price <= 50000)).toBe(true);

    const shoppingCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/shopping")
    );
    expect(shoppingCalls).toHaveLength(10);
    expect(shoppingCalls.map(([, options]) => JSON.parse(options.body).q)).toEqual(
      expect.arrayContaining(catalogue.map((item) => item.query))
    );
  });

  test("clarifies an explicitly combined purchase budget before searching", async () => {
    const fetchMock = mockSerper(() => ({ shopping: [], organic: [] }));
    const query = unique("show me a drone and tv with a total budget of 150000");

    geminiReply({
      budgetScope: "combined",
      intents: [
        { category: "Drones", query: "best camera drone" },
        { category: "Televisions", query: "best smart tv" }
      ]
    });

    const result = await runSearch(query);

    expect(result.status).toBe(200);
    expect(result.payload.clarificationRequired).toBe(true);
    expect(result.payload.reply).toMatch(/total budget/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("applies separate category budgets before Gemini selects products", async () => {
    const phoneListings = [
      shoppingItem("Budget Phone Under Cap", 25000),
      shoppingItem("Budget Phone Over Cap", 40000)
    ];
    const tvListings = [
      shoppingItem("Budget TV Under Cap", 45000),
      shoppingItem("Budget TV Over Cap", 60000)
    ];

    const fetchMock = mockSerper((endpoint, body) => {
      if (endpoint === "shopping" && /phone/i.test(body.q)) return { shopping: phoneListings };
      if (endpoint === "shopping" && /tv/i.test(body.q)) return { shopping: tvListings };
      return { organic: [] };
    });

    const query = unique("phone under 30000 and tv under 50000");
    geminiReply({
      budgetScope: "per_product",
      intents: [
        { category: "Smartphones", query: "budget smartphone", budget: 30000 },
        { category: "Televisions", query: "budget smart tv", budget: 50000 }
      ]
    });
    geminiReply({
      reply: "Phone option.",
      category: "Smartphones",
      picks: [{ index: 0, reason: "Within phone budget." }]
    });
    geminiReply({
      reply: "TV option.",
      category: "Televisions",
      picks: [{ index: 0, reason: "Within TV budget." }]
    });

    const result = await runSearch(query);

    expect(result.status).toBe(200);
    expect(result.payload.results.map((product) => product.name)).toEqual([
      "Budget Phone Under Cap",
      "Budget TV Under Cap"
    ]);
    expect(result.payload.results.every((product) =>
      product.price <= (product.category === "Smartphones" ? 30000 : 50000)
    )).toBe(true);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/shopping"))).toHaveLength(2);
  });

  test("keeps available category results when another category search fails", async () => {
    const tvListings = [shoppingItem("Test Smart Television", 25000)];

    mockSerper((endpoint, body) => {
      if (endpoint === "shopping" && /drone/i.test(body.q)) {
        return { status: 503 };
      }

      if (endpoint === "shopping" && /tv|television/i.test(body.q)) {
        return { shopping: tvListings };
      }

      return { organic: [] };
    });

    const query = unique("show me drone and tv");

    geminiReply({
      intents: [
        { category: "Drones", query: "best camera drone partial failure test" },
        { category: "Televisions", query: "best smart tv partial failure test" }
      ]
    });
    geminiReply({
      reply: "Here are some television options.",
      category: "Televisions",
      picks: [{ index: 0, reason: "A clear screen." }]
    });

    const result = await runSearch(query);

    expect(result.status).toBe(200);
    expect(result.payload.count).toBe(1);
    expect(result.payload.results[0].name).toBe("Test Smart Television");
    expect(result.payload.reply).toMatch(/couldn't fetch Drones listings/i);
    expect(result.payload.missingCategories).toEqual(["Drones"]);
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
