// POST /api/auth/login and GET /api/auth/me, which also cover optionalAuth
// and requireAuth (missing, malformed, expired and foreign tokens).

const request = require("supertest");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { app } = require("../../app");
const { User } = require("../../db");
const { startDB, stopDB, tokenFor } = require("../helpers");

let user;

beforeAll(async () => {
  await startDB();
  user = await User.create({
    name: "Ravi",
    email: "ravi@example.com",
    passwordHash: await bcrypt.hash("password1", 4)
  });
});

afterAll(stopDB);

describe("POST /api/auth/login", () => {
  test.each([
    ["no email", { password: "password1" }],
    ["an unknown email", { email: "nobody@example.com", password: "password1" }],
    ["a wrong password", { email: "ravi@example.com", password: "wrong-pass" }],
    ["a non-string password", { email: "ravi@example.com", password: 12345678 }]
  ])("rejects %s", async (_, body) => {
    const response = await request(app).post("/api/auth/login").send(body);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Invalid email or password.");
  });

  test("signs in with any letter case and spaces around the email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "  RAVI@example.com ", password: "password1" });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("ravi@example.com");
    expect(jwt.verify(response.body.token, "test-secret").sub).toBe(user.id);
  });
});

describe("GET /api/auth/me", () => {
  test("returns the signed-in user", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tokenFor(user)}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ name: "Ravi", role: "user" });
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  test.each([
    ["no Authorization header", null],
    ["a non-Bearer header", `Basic ${Buffer.from("a:b").toString("base64")}`],
    ["a token signed with another secret", `Bearer ${jwt.sign({ sub: "x" }, "other-secret")}`],
    [
      "an expired token",
      `Bearer ${jwt.sign({ sub: "x", exp: Math.floor(Date.now() / 1000) - 60 }, "test-secret")}`
    ],
    ["a malformed token", "Bearer not-a-token"]
  ])("treats %s as a guest (401)", async (_, header) => {
    const call = request(app).get("/api/auth/me");
    const response = await (header ? call.set("Authorization", header) : call);

    expect(response.status).toBe(401);
    expect(response.body.message).toBe("Please sign in to continue.");
  });

  test("rejects a valid token for a deleted account", async () => {
    const gone = await User.create({
      name: "Gone",
      email: "gone@example.com",
      passwordHash: "x"
    });
    const token = tokenFor(gone);

    await gone.deleteOne();

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });
});
