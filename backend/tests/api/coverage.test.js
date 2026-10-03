// GET /api/admin/coverage: reads the json-summary report each test runner
// writes. The file system is mocked, so no real report is needed.

jest.mock("node:fs/promises", () => ({ readFile: jest.fn(), stat: jest.fn() }));

const request = require("supertest");
const fs = require("node:fs/promises");
const { app } = require("../../app");
const { User } = require("../../db");
const { startDB, clearDB, stopDB, tokenFor } = require("../helpers");

let admin;
let member;

beforeAll(startDB);
afterAll(stopDB);

beforeEach(async () => {
  await clearDB();
  admin = await User.create({ name: "Admin", email: "admin@example.com", passwordHash: "x", role: "admin" });
  member = await User.create({ name: "Member", email: "member@example.com", passwordHash: "x" });
});

function coverage(user) {
  const call = request(app).get("/api/admin/coverage");

  return user ? call.set("Authorization", `Bearer ${tokenFor(user)}`) : call;
}

// A report for every path, so both sides resolve the same way.
function reportsSay(summary, mtime = new Date("2026-10-03T10:00:00Z")) {
  fs.readFile.mockResolvedValue(JSON.stringify(summary));
  fs.stat.mockResolvedValue({ mtime });
}

describe("access", () => {
  test("guests get 401", async () => {
    expect((await coverage()).status).toBe(401);
  });

  test("ordinary users get 403", async () => {
    expect((await coverage(member)).status).toBe(403);
  });
});

test("reports statement coverage and when the run happened", async () => {
  reportsSay({ total: { statements: { pct: 98.634 } } });

  const { status, body } = await coverage(admin);

  expect(status).toBe(200);
  expect(body.backend).toEqual({
    available: true,
    statements: 98.6,
    ranAt: "2026-10-03T10:00:00.000Z"
  });
  expect(body.frontend.statements).toBe(98.6);
});

test("a missing report is unavailable, not an error", async () => {
  fs.readFile.mockRejectedValue(new Error("ENOENT"));
  fs.stat.mockRejectedValue(new Error("ENOENT"));

  const { status, body } = await coverage(admin);

  expect(status).toBe(200);
  expect(body.backend).toEqual({ available: false });
  expect(body.frontend).toEqual({ available: false });
});

test("a report without a statements percentage is unavailable", async () => {
  reportsSay({ total: {} });

  expect((await coverage(admin)).body.backend).toEqual({ available: false });
});

test("unreadable JSON is unavailable", async () => {
  fs.readFile.mockResolvedValue("{ not json");
  fs.stat.mockResolvedValue({ mtime: new Date() });

  expect((await coverage(admin)).body.backend).toEqual({ available: false });
});
