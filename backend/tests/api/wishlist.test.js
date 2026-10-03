// /api/wishlist: sign-in, field cleaning, saving twice, the 100-item limit
// and removing.

const request = require("supertest");
const { app } = require("../../app");
const { User, WishlistItem } = require("../../db");
const { startDB, clearDB, stopDB, tokenFor } = require("../helpers");

let user;
let other;

beforeAll(async () => {
  await startDB();
  await WishlistItem.init();
});
afterAll(stopDB);

beforeEach(async () => {
  await clearDB();
  user = await User.create({ name: "Wish", email: "wish@example.com", passwordHash: "x" });
  other = await User.create({ name: "Other", email: "other@example.com", passwordHash: "x" });
});

const as = (who) => ({ Authorization: `Bearer ${tokenFor(who)}` });

const product = {
  id: "p1",
  name: "Apple iPhone 15",
  price: 58990,
  store: "Reliance Digital",
  image: "https://img.example/iphone.jpg",
  rating: 4.6,
  reviews: 30000,
  reason: "Great camera",
  offers: [{ store: "Reliance Digital", price: 58990, link: "https://reliancedigital.in/p" }]
};

function save(who, body) {
  return request(app).post("/api/wishlist").set(as(who)).send(body);
}

test.each([
  ["get", "/api/wishlist"],
  ["post", "/api/wishlist"],
  ["delete", "/api/wishlist?name=x"]
])("%s %s requires sign-in", async (method, path) => {
  expect((await request(app)[method](path)).status).toBe(401);
});

describe("POST /api/wishlist", () => {
  test("saves the product card fields only", async () => {
    const response = await save(user, {
      product: {
        ...product,
        passwordHash: "sneaky",
        rating: "five",
        offers: [
          ...product.offers,
          { store: "", price: 1, link: "x" },
          null,
          ...Array.from({ length: 12 }, (_, index) => ({ store: `S${index}`, price: index }))
        ]
      }
    });

    expect(response.status).toBe(201);

    const saved = response.body.item.product;

    expect(saved.passwordHash).toBeUndefined();
    expect(saved.rating).toBeNull();
    // At most 10 offers are kept, and offers without a store are dropped.
    expect(saved.offers).toHaveLength(8);
    expect(saved.offers[0]).toEqual(product.offers[0]);
    expect(saved.offers[1]).toEqual({ store: "S0", price: 0, link: null });
  });

  test.each([
    ["no product", {}],
    ["a product without a name", { product: { ...product, name: "  " } }],
    ["a product without a price", { product: { ...product, price: "₹58,990" } }],
    ["a product that isn't an object", { product: "iPhone" }]
  ])("rejects %s", async (_, body) => {
    const response = await save(user, body);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe("Please choose a product.");
  });

  test("saving the same product again updates it instead of adding another", async () => {
    await save(user, { product });
    const response = await save(user, { product: { ...product, price: 57000 } });

    expect(response.status).toBe(200);
    expect(await WishlistItem.countDocuments({ user: user._id })).toBe(1);
    expect(response.body.item.product.price).toBe(57000);
  });

  test("allows at most 100 products", async () => {
    await WishlistItem.insertMany(
      Array.from({ length: 100 }, (_, index) => ({
        user: user._id,
        name: `Product ${index}`,
        product: { name: `Product ${index}`, price: index }
      }))
    );

    const response = await save(user, { product });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/wishlist is full/);

    // Updating a product already saved still works when full.
    expect((await save(user, { product: { name: "Product 5", price: 1 } })).status).toBe(200);
  });
});

describe("GET /api/wishlist", () => {
  test("lists only the user's products, newest first", async () => {
    await save(user, { product: { ...product, name: "First" } });
    await save(other, { product: { ...product, name: "Not mine" } });
    await save(user, { product: { ...product, name: "Second" } });

    const response = await request(app).get("/api/wishlist").set(as(user));

    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.name)).toEqual(["Second", "First"]);
    expect(response.body.items[0]).toEqual({
      id: expect.any(String),
      name: "Second",
      product: expect.objectContaining({ name: "Second", price: 58990 }),
      createdAt: expect.any(String)
    });
  });
});

describe("DELETE /api/wishlist", () => {
  test("removes the product", async () => {
    await save(user, { product });

    const response = await request(app)
      .delete(`/api/wishlist?name=${encodeURIComponent(product.name)}`)
      .set(as(user));

    expect(response.status).toBe(204);
    expect(await WishlistItem.countDocuments()).toBe(0);
  });

  test("404 without a name, for unknown products and for other users' items", async () => {
    await save(other, { product });

    expect((await request(app).delete("/api/wishlist").set(as(user))).status).toBe(404);
    expect(
      (await request(app).delete("/api/wishlist?name=Unknown").set(as(user))).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/api/wishlist?name=${encodeURIComponent(product.name)}`)
          .set(as(user))
      ).status
    ).toBe(404);
    expect(await WishlistItem.countDocuments()).toBe(1);
  });
});
