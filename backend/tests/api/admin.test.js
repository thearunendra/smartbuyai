// GET /api/admin/stats: requireAdmin's branches and the statistics.

const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../app");
const { User, Conversation, SearchLog, WishlistItem } = require("../../db");
const { startDB, clearDB, stopDB, tokenFor, mockSerper } = require("../helpers");

let admin;
let member;

beforeAll(startDB);
afterAll(stopDB);

beforeEach(async () => {
  await clearDB();
  admin = await User.create({ name: "Admin", email: "admin@example.com", passwordHash: "x", role: "admin" });
  member = await User.create({ name: "Member", email: "member@example.com", passwordHash: "x" });
});

function stats(user) {
  const call = request(app).get("/api/admin/stats");

  return user ? call.set("Authorization", `Bearer ${tokenFor(user)}`) : call;
}

describe("access", () => {
  test("guests get 401", async () => {
    expect((await stats()).status).toBe(401);
  });

  test("a token for an account that no longer exists gets 401", async () => {
    expect((await stats({ _id: new mongoose.Types.ObjectId() })).status).toBe(401);
  });

  test("regular users get 403", async () => {
    const response = await stats(member);

    expect(response.status).toBe(403);
    expect(response.body.message).toBe("Admin access required.");
  });

  test("removing admin rights takes effect at once", async () => {
    mockSerper(() => ({ balance: 1 }));
    expect((await stats(admin)).status).toBe(200);

    await User.updateOne({ _id: admin._id }, { role: "user" });

    expect((await stats(admin)).status).toBe(403);
  });
});

describe("statistics", () => {
  test("counts searches, categories, products and gaps", async () => {
    mockSerper((endpoint) => {
      expect(endpoint).toBe("account");
      return { balance: 2400 };
    });

    await Conversation.create({ user: member._id, title: "Chat" });
    await WishlistItem.create([
      { user: member._id, name: "P1", product: { name: "P1", price: 100 } },
      { user: member._id, name: "P2", product: { name: "P2", price: 200 } }
    ]);
    await SearchLog.create([
      { query: "phone a", category: "Smartphones", results: 2, products: ["P1", "P2"] },
      { query: "phone b", category: "Smartphones", results: 1, products: ["P1"] },
      { query: "phone c", category: "Smartphones", results: 1, products: ["P3"] },
      { query: "laptop", category: "Laptops", results: 0, products: [] },
      // Older than a week: counted in totals, not in the last 7 days.
      { query: "old", category: "Laptops", results: 1, products: ["L1"], createdAt: new Date(Date.now() - 10 * 86400000) }
    ]);

    const response = await stats(admin);
    const body = response.body;

    expect(response.status).toBe(200);
    expect(body.totalSearches).toBe(5);
    expect(body.searchesLast7Days).toBe(4);
    expect(body.searchesPerDay).toHaveLength(7);
    expect(body.searchesPerDay.at(-1).count).toBe(4);
    expect(body.users).toBe(2);
    expect(body.chats).toBe(1);
    expect(body.wishlistItems).toBe(2);
    expect(body.categories).toEqual([
      { category: "Smartphones", count: 3 },
      { category: "Laptops", count: 2 }
    ]);
    expect(body.mostSearched).toEqual({ category: "Smartphones", count: 3 });
    expect(body.mostSearchedProduct).toEqual({ product: "P1", count: 2 });
    expect(body.zeroResultSearches.map((row) => row.query)).toEqual(["laptop"]);
    expect(body.recentSearches[0]).toEqual({
      query: expect.any(String),
      category: expect.any(String),
      results: expect.any(Number),
      time: expect.any(String)
    });
    expect(body.serperCredits).toBe(2400);
  });

  test("empty statistics when nothing has been searched", async () => {
    mockSerper(() => ({ balance: "unknown" }));

    const body = (await stats(admin)).body;

    expect(body.totalSearches).toBe(0);
    expect(body.mostSearched).toBeNull();
    expect(body.mostSearchedProduct).toBeNull();
    expect(body.serperCredits).toBeNull();
  });

  test.each([
    ["an error status", () => ({ ok: false, status: 500 })],
    ["a network error", () => new Error("offline")]
  ])("Serper credits are null on %s", async (_, reply) => {
    mockSerper(reply);

    expect((await stats(admin)).body.serperCredits).toBeNull();
  });
});
