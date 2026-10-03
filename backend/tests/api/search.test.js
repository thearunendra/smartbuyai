// /api/search, /api/products, /api/product and /api/product/details, plus
// the error handler, CORS and the search rate limit.

const request = require("supertest");
const { app } = require("../../app");
const { User, Conversation, SearchLog } = require("../../db");
const {
  startDB,
  stopDB,
  tokenFor,
  mockSerper,
  geminiReply,
  generateContent,
  shoppingItem,
  unique
} = require("../helpers");

// The search limit counts per signed-in user, so tests use their own users.
let userCount = 0;

async function newUser() {
  userCount += 1;
  const user = await User.create({
    name: `User ${userCount}`,
    email: `user${userCount}@example.com`,
    passwordHash: "x"
  });

  return { user, auth: { Authorization: `Bearer ${tokenFor(user)}` } };
}

// Shopping returns `items`; web searches find nothing (no offer extraction).
function serper(items) {
  return mockSerper((endpoint) => {
    if (endpoint === "shopping") return { shopping: items };
    if (endpoint === "images") return { images: [] };
    return { organic: [] };
  });
}

beforeAll(startDB);
afterAll(stopDB);

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("POST /api/search", () => {
  test("requires sign-in", async () => {
    expect((await request(app).post("/api/search").send({ query: "tv" })).status).toBe(401);
  });

  test.each([
    ["no query", {}],
    ["a blank query", { query: "   " }],
    ["a non-string query", { query: ["tv"] }],
    ["a query over 200 characters", { query: "t".repeat(201) }]
  ])("rejects %s", async (_, body) => {
    const { auth } = await newUser();

    const response = await request(app).post("/api/search").set(auth).send(body);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ count: 0, results: [] });
  });

  test("answers, logs the search and saves the chat", async () => {
    const { user, auth } = await newUser();
    const query = unique("phone");

    serper([shoppingItem("Search Phone One", 15000), shoppingItem("Search Phone Two", 18000)]);
    geminiReply({
      reply: "Try these.",
      category: "Smartphones",
      picks: [{ index: 0, reason: "Good camera" }]
    });

    const response = await request(app).post("/api/search").set(auth).send({ query });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      reply: "Try these.",
      category: "Smartphones",
      count: 1,
      conversationId: expect.any(String)
    });

    const log = await SearchLog.findOne({ query }).lean();

    expect(log).toMatchObject({ category: "Smartphones", results: 1, products: ["Search Phone One"] });
    expect(String(log.user)).toBe(user.id);

    const chat = await Conversation.findById(response.body.conversationId);

    expect(chat.messages.map((message) => message.text)).toEqual([query, "Try these."]);

    // Asking again in the same chat adds to it.
    const again = await request(app)
      .post("/api/search")
      .set(auth)
      .send({ query, conversationId: response.body.conversationId });

    expect(again.body.conversationId).toBe(response.body.conversationId);
    expect((await Conversation.findById(chat.id)).messages).toHaveLength(4);
  });

  test("a failed search is saved as an error and not logged", async () => {
    const { auth } = await newUser();
    const query = unique("tv");

    mockSerper(() => new Error("down"));

    const response = await request(app).post("/api/search").set(auth).send({ query });

    expect(response.status).toBe(502);

    const chat = await Conversation.findById(response.body.conversationId).lean();

    expect(chat.messages[1]).toMatchObject({ error: true, text: response.body.message });
    expect(await SearchLog.countDocuments({ query })).toBe(0);
  });

  test("still answers when the chat can't be saved", async () => {
    const { auth } = await newUser();

    serper([shoppingItem("Unsaved Phone", 15000)]);
    geminiReply({ reply: "r", category: "Smartphones", picks: [{ index: 0, reason: "x" }] });
    jest.spyOn(Conversation.prototype, "save").mockRejectedValueOnce(new Error("disk full"));

    const response = await request(app).post("/api/search").set(auth).send({ query: unique("phone") });

    expect(response.status).toBe(200);
    expect(response.body.conversationId).toBeUndefined();
    expect(console.log).toHaveBeenCalledWith("Chat Save Error:", "disk full");
  });

  test("limits each user to 10 searches a minute", async () => {
    const first = await newUser();
    const second = await newUser();

    for (let i = 0; i < 10; i += 1) {
      await request(app).post("/api/search").set(first.auth).send({});
    }

    const blocked = await request(app).post("/api/search").set(first.auth).send({});

    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toMatch(/searching too fast/);

    // Counted per user: someone else can still search.
    expect((await request(app).post("/api/search").set(second.auth).send({})).status).toBe(400);
  });
});

describe("GET /api/products", () => {
  test("an unknown category falls back to Smartphones, and pages are cached", async () => {
    const fetchMock = serper([shoppingItem("Browse Phone", 20000)]);

    geminiReply({ indexes: [0] });

    const first = await request(app).get("/api/products?category=Spaceships");

    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ category: "Smartphones", query: "best 5g smartphone", count: 1 });

    const calls = fetchMock.mock.calls.length;
    const second = await request(app).get("/api/products?category=Spaceships");

    expect(second.body).toEqual(first.body);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  test("a search text replaces the category's query", async () => {
    serper([shoppingItem("Searched Sofa", 30000)]);
    geminiReply({ indexes: [0] });

    const response = await request(app).get(`/api/products?category=Sofas&q=${encodeURIComponent(unique("blue sofa"))}`);

    expect(response.body.category).toBe("Sofas");
    expect(response.body.query).toMatch(/^blue sofa/);
    expect(response.body.products[0].name).toBe("Searched Sofa");
  });

  test("502 when live listings can't be fetched", async () => {
    mockSerper(() => new Error("down"));

    const response = await request(app).get("/api/products?category=Beds");

    expect(response.status).toBe(502);
    expect(response.body.products).toEqual([]);
  });
});

describe("product details routes", () => {
  let auth;

  beforeAll(async () => {
    ({ auth } = await newUser());
  });

  test.each([
    ["/api/product"],
    ["/api/product?name="],
    [`/api/product?name=${"n".repeat(201)}`],
    ["/api/product/details?name=%20"]
  ])("%s answers 400", async (path) => {
    expect((await request(app).get(path).set(auth)).status).toBe(400);
  });

  test("GET /api/product returns the product with its offers", async () => {
    serper([shoppingItem("Route Phone", 25000, "croma.com")]);

    const response = await request(app).get("/api/product?name=Route%20Phone").set(auth);

    expect(response.status).toBe(200);
    expect(response.body.product).toMatchObject({
      name: "Route Phone",
      price: 25000,
      store: "Croma",
      offers: [{ store: "Croma", price: 25000, link: null }]
    });
  });

  test("GET /api/product answers 404 when nothing is found and 502 on errors", async () => {
    serper([]);
    expect((await request(app).get("/api/product?name=Missing%20Thing").set(auth)).status).toBe(404);

    mockSerper(() => new Error("down"));
    expect((await request(app).get("/api/product?name=Broken%20Thing").set(auth)).status).toBe(502);
  });

  test("GET /api/product/details passes a valid price on and ignores others", async () => {
    serper([]);
    geminiReply({ brand: "B", shortName: "Detail Route", competitors: [], similarQuery: "" });

    const response = await request(app)
      .get("/api/product/details?name=Detail%20Route&price=45000")
      .set(auth);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ brand: "B", available: true });
    expect(generateContent.mock.calls[0][0].contents).toContain("Current lowest price: ₹45000");

    geminiReply({ brand: "B", competitors: [], similarQuery: "" });
    await request(app).get("/api/product/details?name=Detail%20Route%202&price=abc").set(auth);

    expect(generateContent.mock.calls[1][0].contents).not.toContain("Current lowest price");
  });
});

describe("errors, CORS and health", () => {
  test("the health check reports the database", async () => {
    expect((await request(app).get("/api/health")).body).toEqual({ ok: true, database: "connected" });
  });

  test("invalid JSON answers 400", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send("{bad json");

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Invalid request body.");
  });

  test("unexpected errors answer 500 without details", async () => {
    const { auth } = await newUser();

    jest.spyOn(Conversation, "find").mockImplementationOnce(() => {
      throw new Error("database exploded");
    });

    const response = await request(app).get("/api/chats").set(auth);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe("Something went wrong. Please try again.");
    expect(JSON.stringify(response.body)).not.toContain("exploded");
  });

  test("CORS allows the configured frontend only", async () => {
    const allowed = await request(app).get("/api/health").set("Origin", "http://localhost:5173");
    const blocked = await request(app).get("/api/health").set("Origin", "https://evil.example");

    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  test("security headers are set", async () => {
    const response = await request(app).get("/api/health");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });
});
