// POST /api/auth/register: every validation branch, then the sign-in rate
// limit (10 attempts per 15 minutes; this file makes exactly 11).

const request = require("supertest");
const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const { app } = require("../../app");
const { User } = require("../../db");
const { startDB, stopDB } = require("../helpers");

beforeAll(startDB);
afterAll(stopDB);

const valid = { name: "Asha", email: "asha@example.com", password: "secret123" };

function register(body) {
  return request(app).post("/api/auth/register").send(body);
}

test.each([
  ["a missing name", { ...valid, name: "   " }, "Please enter your name."],
  ["a name over 80 characters", { ...valid, name: "a".repeat(81) }, "Please enter your name."],
  ["a non-string name", { ...valid, name: 42 }, "Please enter your name."],
  ["an invalid email", { ...valid, email: "asha@example" }, "Please enter a valid email."],
  [
    "an email over 254 characters",
    { ...valid, email: `${"a".repeat(250)}@example.com` },
    "Please enter a valid email."
  ],
  ["a password under 8 characters", { ...valid, password: "short" }, "Password must be between 8 and 128 characters."],
  ["a password over 128 characters", { ...valid, password: "p".repeat(129) }, "Password must be between 8 and 128 characters."]
])("rejects %s", async (_, body, message) => {
  const response = await register(body);

  expect(response.status).toBe(400);
  expect(response.body.message).toBe(message);
});

test("creates the account with a hashed password", async () => {
  const response = await register({ ...valid, email: "  Asha@Example.COM " });

  expect(response.status).toBe(201);
  expect(response.body.token).toEqual(expect.any(String));
  expect(response.body.user).toEqual({
    id: expect.any(String),
    name: "Asha",
    email: "asha@example.com",
    role: "user",
    createdAt: expect.any(String)
  });

  const saved = await User.findOne({ email: "asha@example.com" });

  expect(saved.passwordHash.startsWith("sha256-bcrypt$")).toBe(true);
  const storedHash = saved.passwordHash.slice("sha256-bcrypt$".length);
  const digest = crypto.createHash("sha256").update("secret123", "utf8").digest("hex");
  expect(await bcrypt.compare(digest, storedHash)).toBe(true);
  expect(await bcrypt.compare("secret123", storedHash)).toBe(false);
});

test("supports passwords longer than bcrypt's 72-byte input limit", async () => {
  const password = "p".repeat(100);
  const response = await register({
    ...valid,
    email: "long-password@example.com",
    password
  });

  expect(response.status).toBe(201);
  const saved = await User.findOne({ email: "long-password@example.com" });
  const digest = crypto.createHash("sha256").update(password, "utf8").digest("hex");
  expect(
    await bcrypt.compare(digest, saved.passwordHash.slice("sha256-bcrypt$".length))
  ).toBe(true);
});

test("rejects an email that is already registered", async () => {
  const response = await register(valid);

  expect(response.status).toBe(409);
});

test("limits sign-in attempts to 10 per 15 minutes", async () => {
  // Use an isolated client IP so validation cases above don't consume this counter.
  const clientIp = "203.0.113.200";

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await request(app)
      .post("/api/auth/register")
      .set("X-Forwarded-For", clientIp)
      .send({});
    expect(response.status).toBe(400);
  }

  const blocked = await request(app)
    .post("/api/auth/register")
    .set("X-Forwarded-For", clientIp)
    .send(valid);

  expect(blocked.status).toBe(429);
  expect(blocked.body.message).toMatch(/Too many sign-in attempts/);
});
