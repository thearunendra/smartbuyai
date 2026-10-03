// requireDB: account features answer 503 when MongoDB isn't connected or
// JWT_SECRET is missing, while the health check still works.

const request = require("supertest");
const { app } = require("../../app");

test("the health check reports the database as disconnected", async () => {
  const response = await request(app).get("/api/health");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ ok: true, database: "disconnected" });
});

test.each([
  ["post", "/api/auth/register"],
  ["post", "/api/auth/login"],
  ["get", "/api/chats"],
  ["get", "/api/wishlist"],
  ["post", "/api/search"],
  ["get", "/api/admin/stats"]
])("%s %s answers 503 without a database", async (method, path) => {
  const response = await request(app)[method](path).send({});

  expect(response.status).toBe(503);
  expect(response.body.message).toMatch(/not available right now/);
});

test("accounts are unavailable without JWT_SECRET", async () => {
  let isolatedApp;

  delete process.env.JWT_SECRET;
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.isolateModules(() => {
    isolatedApp = require("../../app").app;

    // Pretend the database is up: only the missing secret should matter.
    const mongoose = require("mongoose");

    Object.defineProperty(mongoose.connection, "readyState", { get: () => 1 });
  });
  process.env.JWT_SECRET = "test-secret";

  const response = await request(isolatedApp).post("/api/auth/login").send({});

  expect(response.status).toBe(503);
  expect(console.log).toHaveBeenCalledWith(
    "Auth: JWT_SECRET not set (sign-in disabled)"
  );
});
