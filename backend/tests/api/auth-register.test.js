// POST /api/auth/register: every validation branch, then the sign-in rate
// limit (10 attempts per 15 minutes; this file makes exactly 11).

const request = require("supertest");
const bcrypt = require("bcryptjs");
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
  ["a password under 8 characters", { ...valid, password: "short" }, "Password must be at least 8 characters."],
  ["a password over 128 characters", { ...valid, password: "p".repeat(129) }, "Password must be at least 8 characters."]
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

  expect(saved.passwordHash).not.toBe("secret123");
  expect(await bcrypt.compare("secret123", saved.passwordHash)).toBe(true);
});

test("rejects an email that is already registered", async () => {
  const response = await register(valid);

  expect(response.status).toBe(409);
});

test("limits sign-in attempts to 10 per 15 minutes", async () => {
  // This is the 10th attempt from this address: still handled.
  expect((await register({})).status).toBe(400);

  const blocked = await register(valid);

  expect(blocked.status).toBe(429);
  expect(blocked.body.message).toMatch(/Too many sign-in attempts/);
});
