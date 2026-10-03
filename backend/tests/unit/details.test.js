// Product details page pipeline: product lookup, image filter, Gemini
// output cleanup, alternatives and caching.

const { internals } = require("../../app");
const {
  mockSerper,
  geminiReply,
  geminiFails,
  generateContent,
  shoppingItem
} = require("../helpers");

const {
  lookupProduct,
  findImages,
  describeProduct,
  findAlternatives,
  getProductDetails
} = internals;

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

// Shopping results per query text; web searches find nothing.
function serperByQuery(results) {
  return mockSerper((endpoint, body) => {
    if (endpoint === "shopping") {
      return { shopping: results[body.q] || [] };
    }

    return endpoint === "images" ? { images: [] } : { organic: [] };
  });
}

describe("lookupProduct", () => {
  test("uses the exact name match among new listings, without Gemini", async () => {
    serperByQuery({
      "Lookup Phone One": [
        shoppingItem("Lookup Phone One (Refurbished)", 30000),
        shoppingItem("Lookup Phone One Pro", 70000),
        shoppingItem("Lookup Phone One", 50000, "flipkart.com")
      ]
    });

    const product = await lookupProduct("Lookup Phone One");

    expect(product).toMatchObject({ name: "Lookup Phone One", price: 50000, store: "Flipkart" });
    expect(product.offers).toEqual([{ store: "Flipkart", price: 50000, link: null }]);
    expect(generateContent).not.toHaveBeenCalled();
  });

  test("without an exact match, Gemini skips accessories", async () => {
    serperByQuery({
      "Lookup Phone Two": [
        shoppingItem("Lookup Phone Two Back Cover", 299),
        shoppingItem("Brand Lookup Phone Two 5G", 45000)
      ]
    });
    geminiReply({ reply: "", category: "Smartphones", picks: [{ index: 1, reason: "r" }] });

    const product = await lookupProduct("Lookup Phone Two");

    expect(product.name).toBe("Brand Lookup Phone Two 5G");
  });

  test("falls back to the closest name when Gemini fails", async () => {
    serperByQuery({
      "Lookup Phone Three": [
        shoppingItem("Lookup Phone Three Case Cover", 299),
        shoppingItem("Google Lookup Phone Three", 40000)
      ]
    });
    geminiFails();

    const product = await lookupProduct("Lookup Phone Three");

    expect(product.name).toBe("Google Lookup Phone Three");
  });

  test("uses used listings only when there is nothing else", async () => {
    serperByQuery({
      "Lookup Phone Four": [shoppingItem("Lookup Phone Four", 9000, "cashify.in")]
    });

    const product = await lookupProduct("Lookup Phone Four");

    expect(product.store).toBe("Cashify");
  });

  test("returns null when nothing is found", async () => {
    serperByQuery({});

    await expect(lookupProduct("Lookup Nothing")).resolves.toBeNull();
  });
});

describe("findImages", () => {
  const image = (title, url, extra = {}) => ({
    title,
    imageUrl: url,
    imageWidth: 1000,
    imageHeight: 1000,
    thumbnailUrl: `https://thumbs.example/${encodeURIComponent(url)}`,
    source: "Amazon.in",
    domain: "www.amazon.in",
    ...extra
  });

  test("keeps product photos of this exact model only, up to 6", async () => {
    const fetchMock = mockSerper(() => ({
      images: [
        image("Samsung Galaxy S24 5G", "https://a.example/1.jpg"),
        image("Samsung Galaxy S24 5G", "https://a.example/1.jpg"),
        image("Samsung Galaxy S24", "http://insecure.example/2.jpg"),
        image("Samsung Galaxy S24 Ultra", "https://a.example/ultra.jpg"),
        image("Samsung Galaxy S23", "https://a.example/s23.jpg"),
        image("Galaxy S24 (Refurbished)", "https://a.example/refurb.jpg"),
        image("Galaxy S24", "https://a.example/used.jpg", { domain: "sell.gameloot.in" }),
        image("Galaxy S24", "https://a.example/small.jpg", { imageWidth: 300, imageHeight: 300 }),
        image("Galaxy S24", "https://a.example/banner.jpg", { imageWidth: 1600, imageHeight: 800 }),
        image("Galaxy S24", "https://a.example/tall.jpg", { imageWidth: 500, imageHeight: 1000 }),
        image("Galaxy S24", "https://a.example/nothumb.jpg", { thumbnailUrl: "x" }),
        ...[3, 4, 5, 6, 7, 8].map((n) => image("Galaxy S24", `https://a.example/${n}.jpg`))
      ]
    }));

    const images = await findImages("Samsung Galaxy S24 5G", { shortName: "Galaxy S24" });

    expect(images.map((item) => item.url)).toEqual([
      "https://a.example/1.jpg",
      "https://a.example/nothumb.jpg",
      "https://a.example/3.jpg",
      "https://a.example/4.jpg",
      "https://a.example/5.jpg",
      "https://a.example/6.jpg"
    ]);
    expect(images[0].thumb).toMatch(/^https:\/\/thumbs\.example\//);
    expect(images[1].thumb).toBeNull();

    // Cached: the second call doesn't search again.
    await findImages("Samsung Galaxy S24 5G", { shortName: "Galaxy S24" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("works without Gemini's details and with no results", async () => {
    mockSerper(() => ({}));

    await expect(findImages("Plain Kettle", null)).resolves.toEqual([]);
  });
});

describe("describeProduct", () => {
  test("cleans Gemini's output", async () => {
    geminiReply({
      brand: "  Apple ",
      shortName: "iPhone 15",
      variant: ["128GB", "", "Pink", "5G", "iOS", "Extra"],
      mrp: 79900.5,
      summary: "A great phone.",
      pros: ["A", "", "B", "C", "D", "E", "F"],
      highlights: [
        { icon: "chip", title: "A16 Bionic", detail: "Chip" },
        { icon: "rocket", title: "Fast", detail: "Charging" },
        { icon: "camera", title: "", detail: "No title" }
      ],
      specs: [
        { group: "Display", items: [{ label: "Size", value: "6.1 inch" }, { label: "", value: "x" }] },
        { group: "Empty", items: [] },
        { group: "", items: [{ label: "a", value: "b" }] }
      ],
      featureScore: 11,
      brandScore: "9",
      category: "Phones",
      competitors: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
      similarQuery: " 5g phone "
    });

    const info = await describeProduct("Apple iPhone 15", 58990, []);

    expect(info).toEqual({
      brand: "Apple",
      shortName: "iPhone 15",
      variant: ["128GB", "Pink", "5G", "iOS"],
      mrp: null,
      summary: "A great phone.",
      pros: ["A", "B", "C", "D", "E"],
      highlights: [
        { icon: "chip", title: "A16 Bionic", detail: "Chip" },
        { icon: "other", title: "Fast", detail: "Charging" }
      ],
      specs: [{ group: "Display", items: [{ label: "Size", value: "6.1 inch" }] }],
      featureScore: 10,
      brandScore: null,
      category: "Other",
      competitors: ["A", "B", "C", "D", "E", "F", "G", "H"],
      similarQuery: "5g phone"
    });
    expect(generateContent.mock.calls[0][0].contents).toContain(
      "Current lowest price: ₹58990"
    );
  });

  test("missing fields become empty values", async () => {
    geminiReply({ mrp: 69900, category: "Smartphones" });

    const info = await describeProduct("Phone", null, []);

    expect(info).toMatchObject({
      brand: "",
      variant: [],
      mrp: 69900,
      pros: [],
      highlights: [],
      specs: [],
      featureScore: null,
      category: "Smartphones",
      competitors: []
    });
    expect(generateContent.mock.calls[0][0].contents).not.toContain("Current lowest price");
  });
});

describe("findAlternatives", () => {
  test("finds each competitor, asks for more at this price, then fills up", async () => {
    serperByQuery({
      "Rival One": [
        shoppingItem("Rival One Back Cover", 299),
        shoppingItem("Rival One Pro", 52000),
        shoppingItem("Rival One", 48000, "smallshop.in"),
        shoppingItem("Rival One 5G", 49000, "flipkart.com")
      ],
      "Rival Two": [
        shoppingItem("Rival Two (Refurbished)", 30000),
        shoppingItem("Hero Phone 15", 51000)
      ],
      "Rival Three": [shoppingItem("Rival Three", 55000, "croma.com")],
      "5g phone": [
        shoppingItem("Budget Phone", 20000),
        shoppingItem("Rival Three", 55000, "croma.com"),
        shoppingItem("Cheap Case", 200)
      ]
    });

    // Only one competitor is near the price, so Gemini is asked for more,
    // then the generic search is filtered.
    geminiReply({ models: ["Rival Three", "Rival One"] });
    geminiReply({ indexes: [0] });

    const alternatives = await findAlternatives("Hero Phone 15", 50000, {
      shortName: "Hero Phone 15",
      competitors: ["Rival One", "Rival Two"],
      similarQuery: "5g phone",
      category: "Smartphones"
    });

    expect(alternatives.map((item) => `${item.name} @ ${item.store}`)).toEqual([
      // A known store wins over a closer name from an unknown shop.
      "Rival One 5G @ Flipkart",
      "Rival Three @ Croma",
      "Budget Phone @ Amazon"
    ]);
    expect(generateContent.mock.calls[0][0].contents).toContain("₹42500 to ₹65000");
  });

  test("without a price there is no price band and no second round", async () => {
    serperByQuery({
      "speaker zz": [shoppingItem("Speaker A", 100), shoppingItem("Speaker B", 90000)]
    });
    geminiFails();

    const alternatives = await findAlternatives("My Speaker", null, {
      shortName: "My Speaker",
      competitors: [],
      similarQuery: "speaker zz",
      category: "Other"
    });

    // Gemini's filter failed, so the listings come back as they are.
    expect(alternatives.map((item) => item.name)).toEqual(["Speaker A", "Speaker B"]);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  test("survives a failed second round and an empty fill-up search", async () => {
    serperByQuery({});
    geminiFails();

    const alternatives = await findAlternatives("Solo Phone", 30000, {
      shortName: "Solo Phone",
      competitors: ["Solo Rival"],
      similarQuery: "solo query",
      category: "Smartphones"
    });

    expect(alternatives).toEqual([]);
  });
});

describe("getProductDetails", () => {
  const info = {
    brand: "Brand",
    shortName: "Detail Phone",
    variant: [],
    mrp: 0,
    summary: "Good.",
    pros: [],
    highlights: [],
    specs: [],
    featureScore: 8,
    brandScore: 8,
    category: "Smartphones",
    competitors: ["Detail Rival"],
    similarQuery: "detail query"
  };

  test("combines everything and caches a complete page", async () => {
    const fetchMock = serperByQuery({});

    geminiReply(info);
    geminiReply({ models: [] });

    const details = await getProductDetails("Detail Phone One", 30000);

    expect(details).toMatchObject({
      brand: "Brand",
      images: [],
      alternatives: [],
      available: true
    });

    const calls = fetchMock.mock.calls.length;

    await expect(getProductDetails("Detail Phone One", 30000)).resolves.toEqual(details);
    expect(fetchMock.mock.calls.length).toBe(calls);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test("a big price change gives fresh alternatives", async () => {
    serperByQuery({});
    geminiReply(info);
    geminiReply({ models: [] });
    await getProductDetails("Detail Phone Two", 30000);

    geminiReply(info);
    geminiReply({ models: [] });
    await getProductDetails("Detail Phone Two", 60000);

    expect(generateContent).toHaveBeenCalledTimes(4);
  });

  test("is unavailable and not cached when Gemini fails", async () => {
    serperByQuery({});
    geminiFails();

    const details = await getProductDetails("Detail Phone Three", 30000);

    expect(details).toEqual({ images: [], alternatives: [], available: false });

    geminiFails();
    await getProductDetails("Detail Phone Three", 30000);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test("a failed spec search still describes the product but isn't cached", async () => {
    mockSerper((endpoint) => (endpoint === "search" ? new Error("timeout") : {}));
    geminiReply({ ...info, competitors: [], similarQuery: "" });

    const details = await getProductDetails("Detail Phone Four", null);

    expect(details.available).toBe(true);

    geminiReply({ ...info, competitors: [], similarQuery: "" });
    await getProductDetails("Detail Phone Four", null);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  test("a failed alternatives search isn't cached", async () => {
    mockSerper((endpoint) => (endpoint === "shopping" ? new Error("down") : {}));
    geminiReply({ ...info, competitors: [] });

    const details = await getProductDetails("Detail Phone Five", 30000);

    expect(details.alternatives).toEqual([]);
    expect(details.available).toBe(true);
  });
});
