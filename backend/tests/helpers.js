const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { generateContent } = require("@google/genai");

// Queues one Gemini reply (the JSON the model would return).
function geminiReply(data) {
  generateContent.mockResolvedValueOnce({ text: JSON.stringify(data) });
}

function geminiFails(message = "Gemini unavailable") {
  generateContent.mockRejectedValueOnce(new Error(message));
}

// Replaces fetch for Serper. handler(endpoint, body) returns the JSON to
// send back, an Error to throw (network failure) or { status } for an
// error response.
function mockSerper(handler) {
  return jest.spyOn(global, "fetch").mockImplementation(async (url, options = {}) => {
    const endpoint = String(url).split("/").pop();
    const body = options.body ? JSON.parse(options.body) : {};
    const result = await handler(endpoint, body);

    if (result instanceof Error) {
      throw result;
    }

    if (result && typeof result.status === "number" && !result.ok) {
      return { ok: false, status: result.status, json: async () => ({}) };
    }

    return { ok: true, status: 200, json: async () => result };
  });
}

// Google Shopping item as Serper returns it.
function shoppingItem(title, price, source = "amazon.in", extra = {}) {
  return {
    title,
    price: `₹${price.toLocaleString("en-IN")}`,
    source,
    imageUrl: `https://img.example/${encodeURIComponent(title)}.jpg`,
    rating: 4.4,
    ratingCount: 1200,
    ...extra
  };
}

// Distinct search text per test, so cached results never leak between tests.
let counter = 0;

function unique(text) {
  counter += 1;
  return `${text} t${counter}x${Date.now()}`;
}

function tokenFor(user) {
  return jwt.sign({ sub: String(user._id ?? user.id) }, process.env.JWT_SECRET, {
    expiresIn: "1h"
  });
}

// ---- In-memory MongoDB ----

let mongoServer;

async function startDB() {
  const { MongoMemoryServer } = require("mongodb-memory-server");

  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {
    dbName: "smartbuy-test",
    // The driver loads `os` with a dynamic import(), which fails inside Jest's
    // sandbox and leaves the handshake without driver info (MongoDB then
    // rejects it). Passing the module directly avoids the import.
    runtimeAdapters: { os: require("os") }
  });
}

async function clearDB() {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({})
    )
  );
}

async function stopDB() {
  await mongoose.disconnect();
  await mongoServer?.stop();
}

module.exports = {
  geminiReply,
  geminiFails,
  mockSerper,
  shoppingItem,
  unique,
  tokenFor,
  startDB,
  clearDB,
  stopDB,
  generateContent
};
