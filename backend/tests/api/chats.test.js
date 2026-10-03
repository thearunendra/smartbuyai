// /api/chats routes (ownership checks on every route) and saveExchange.

const request = require("supertest");
const mongoose = require("mongoose");
const { app } = require("../../app");
const { User, Conversation, MAX_MESSAGES } = require("../../db");
const { saveExchange } = require("../../chats");
const { startDB, clearDB, stopDB, tokenFor } = require("../helpers");

let owner;
let other;

beforeAll(startDB);
afterAll(stopDB);

beforeEach(async () => {
  await clearDB();
  owner = await User.create({ name: "Owner", email: "owner@example.com", passwordHash: "x" });
  other = await User.create({ name: "Other", email: "other@example.com", passwordHash: "x" });
});

const as = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

function chatFor(user, title, messages = []) {
  return Conversation.create({ user: user._id, title, messages });
}

test("requires sign-in", async () => {
  expect((await request(app).get("/api/chats")).status).toBe(401);
});

describe("GET /api/chats", () => {
  test("lists only the user's chats, newest first, without messages", async () => {
    const older = await chatFor(owner, "Older", [{ role: "user", text: "hi" }]);
    await chatFor(other, "Not mine");
    const newer = await chatFor(owner, "Newer");

    await Conversation.updateOne({ _id: older._id }, { updatedAt: new Date(2020, 0, 1) }, { timestamps: false });

    const response = await request(app).get("/api/chats").set(as(owner));

    expect(response.status).toBe(200);
    expect(response.body.chats.map((chat) => chat.title)).toEqual(["Newer", "Older"]);
    expect(response.body.chats[0]).toEqual({
      id: newer.id,
      title: "Newer",
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
  });
});

describe("GET /api/chats/:id", () => {
  test("returns the user's chat with its messages", async () => {
    const chat = await chatFor(owner, "Phones", [
      { role: "user", text: "phone under 20k" },
      { role: "ai", text: "Here you go", products: [{ name: "P" }] }
    ]);

    const response = await request(app).get(`/api/chats/${chat.id}`).set(as(owner));

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("Phones");
    expect(response.body.messages).toHaveLength(2);
    expect(response.body.messages[1].products).toEqual([{ name: "P" }]);
  });

  test.each([
    ["an invalid id", () => "not-an-id"],
    ["an unknown id", () => new mongoose.Types.ObjectId().toString()]
  ])("404 for %s", async (_, id) => {
    const response = await request(app).get(`/api/chats/${id()}`).set(as(owner));

    expect(response.status).toBe(404);
  });

  test("404 for someone else's chat", async () => {
    const chat = await chatFor(other, "Private");

    expect((await request(app).get(`/api/chats/${chat.id}`).set(as(owner))).status).toBe(404);
  });
});

describe("PATCH /api/chats/:id", () => {
  test("renames the chat, trimmed to 100 characters", async () => {
    const chat = await chatFor(owner, "Old");

    const response = await request(app)
      .patch(`/api/chats/${chat.id}`)
      .set(as(owner))
      .send({ title: `  ${"x".repeat(120)}  ` });

    expect(response.status).toBe(200);
    expect(response.body.title).toBe("x".repeat(100));
    expect((await Conversation.findById(chat.id)).title).toBe("x".repeat(100));
  });

  test.each([[""], ["   "], [42]])("rejects the title %p", async (title) => {
    const chat = await chatFor(owner, "Old");

    const response = await request(app)
      .patch(`/api/chats/${chat.id}`)
      .set(as(owner))
      .send({ title });

    expect(response.status).toBe(400);
  });

  test("404 for someone else's chat", async () => {
    const chat = await chatFor(other, "Private");

    const response = await request(app)
      .patch(`/api/chats/${chat.id}`)
      .set(as(owner))
      .send({ title: "Mine now" });

    expect(response.status).toBe(404);
    expect((await Conversation.findById(chat.id)).title).toBe("Private");
  });
});

describe("DELETE /api/chats/:id", () => {
  test("deletes the chat once", async () => {
    const chat = await chatFor(owner, "Bye");

    expect((await request(app).delete(`/api/chats/${chat.id}`).set(as(owner))).status).toBe(204);
    expect((await request(app).delete(`/api/chats/${chat.id}`).set(as(owner))).status).toBe(404);
  });

  test("404 for an invalid id or someone else's chat", async () => {
    const chat = await chatFor(other, "Private");

    expect((await request(app).delete("/api/chats/bad-id").set(as(owner))).status).toBe(404);
    expect((await request(app).delete(`/api/chats/${chat.id}`).set(as(owner))).status).toBe(404);
    expect(await Conversation.findById(chat.id)).not.toBeNull();
  });
});

describe("saveExchange", () => {
  const answer = { text: "Here you go", error: false, products: [{ name: "P1" }] };

  test("starts a new chat titled with the question", async () => {
    const id = await saveExchange(owner._id, undefined, "phone under 20k", answer);
    const chat = await Conversation.findById(id);

    expect(chat.title).toBe("phone under 20k");
    expect(chat.messages.map((message) => message.role)).toEqual(["user", "ai"]);
    expect(chat.messages[1].products).toEqual([{ name: "P1" }]);
  });

  test("shortens long titles to 60 characters", async () => {
    const query = "q".repeat(80);
    const chat = await Conversation.findById(await saveExchange(owner._id, null, query, answer));

    expect(chat.title).toBe(`${"q".repeat(57)}...`);
  });

  test("adds to the user's existing chat", async () => {
    const existing = await chatFor(owner, "Existing");

    const id = await saveExchange(owner._id, existing.id, "second", answer);

    expect(id).toBe(existing.id);
    expect((await Conversation.findById(id)).messages).toHaveLength(2);
  });

  test("never adds to someone else's chat", async () => {
    const foreign = await chatFor(other, "Foreign");

    const id = await saveExchange(owner._id, foreign.id, "sneaky", answer);

    expect(id).not.toBe(foreign.id);
    expect((await Conversation.findById(foreign.id)).messages).toHaveLength(0);
  });

  test("stores errors and leaves out an empty product list", async () => {
    const id = await saveExchange(owner._id, null, "x", { text: "Failed", error: true, products: [] });
    const chat = await Conversation.findById(id).lean();

    expect(chat.messages[1]).toMatchObject({ role: "ai", text: "Failed", error: true });
    expect(chat.messages[1].products).toBeUndefined();
  });

  test(`keeps only the newest ${MAX_MESSAGES} messages`, async () => {
    const full = await chatFor(
      owner,
      "Full",
      Array.from({ length: MAX_MESSAGES - 1 }, (_, index) => ({ role: "user", text: `m${index}` }))
    );

    await saveExchange(owner._id, full.id, "latest", answer);

    const chat = await Conversation.findById(full.id);

    expect(chat.messages).toHaveLength(MAX_MESSAGES);
    expect(chat.messages[0].text).toBe("m1");
    expect(chat.messages.at(-1).text).toBe("Here you go");
  });
});
