const express = require("express");
const mongoose = require("mongoose");
const { Conversation, MAX_MESSAGES } = require("./db");
const { optionalAuth, requireAuth, requireDB } = require("./auth");

const router = express.Router();

router.use(requireDB, optionalAuth, requireAuth);

function findOwned(req) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return null;
  }

  return Conversation.findOne({ _id: req.params.id, user: req.userId });
}

// Sidebar list: newest first, without the messages themselves.
router.get("/", async (req, res) => {
  const chats = await Conversation.find({ user: req.userId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .select("title updatedAt createdAt")
    .lean();

  res.json({
    chats: chats.map((chat) => ({
      id: String(chat._id),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }))
  });
});

router.get("/:id", async (req, res) => {
  const chat = await findOwned(req);

  if (!chat) {
    return res.status(404).json({ message: "Chat not found." });
  }

  res.json({
    id: chat.id,
    title: chat.title,
    messages: chat.messages,
    updatedAt: chat.updatedAt
  });
});

router.patch("/:id", async (req, res) => {
  const title =
    typeof req.body.title === "string" ? req.body.title.trim().slice(0, 100) : "";

  if (!title) {
    return res.status(400).json({ message: "Please enter a title." });
  }

  const chat = await findOwned(req);

  if (!chat) {
    return res.status(404).json({ message: "Chat not found." });
  }

  chat.title = title;
  await chat.save();

  res.json({ id: chat.id, title: chat.title });
});

router.delete("/:id", async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: "Chat not found." });
  }

  const result = await Conversation.deleteOne({
    _id: req.params.id,
    user: req.userId
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ message: "Chat not found." });
  }

  res.status(204).end();
});

// Adds a question and its answer to a user's conversation, creating the
// conversation when needed. Returns the conversation id.
async function saveExchange(userId, conversationId, query, answer) {
  let chat = null;

  if (mongoose.isValidObjectId(conversationId)) {
    chat = await Conversation.findOne({ _id: conversationId, user: userId });
  }

  if (!chat) {
    chat = new Conversation({
      user: userId,
      title: query.length > 60 ? `${query.slice(0, 57)}...` : query
    });
  }

  chat.messages.push(
    { role: "user", text: query },
    {
      role: "ai",
      text: answer.text,
      error: answer.error,
      products: answer.products?.length ? answer.products : undefined
    }
  );

  if (chat.messages.length > MAX_MESSAGES) {
    chat.messages.splice(0, chat.messages.length - MAX_MESSAGES);
  }

  await chat.save();

  return chat.id;
}

module.exports = {
  chatsRouter: router,
  saveExchange
};
