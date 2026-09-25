const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, isDBReady } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = "7d";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!JWT_SECRET) {
  console.log("Auth: JWT_SECRET not set (sign-in disabled)");
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "user",
    createdAt: user.createdAt
  };
}

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}


// =====================================================
// MIDDLEWARE
// =====================================================

// Sets req.userId when a valid token is sent; guests continue without one.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (JWT_SECRET && header.startsWith("Bearer ")) {
    try {
      req.userId = jwt.verify(header.slice(7), JWT_SECRET).sub;
    } catch {
      // Expired or invalid token: treat as a guest.
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  next();
}

// Checks the role in the database on every request, so removing admin
// rights takes effect immediately (not when the token expires).
async function requireAdmin(req, res, next) {
  const user = req.userId
    ? await User.findById(req.userId).select("role").lean()
    : null;

  if (!user) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  if (user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }

  next();
}

function requireDB(req, res, next) {
  if (!isDBReady() || !JWT_SECRET) {
    return res.status(503).json({
      message: "Accounts are not available right now. Please try again later."
    });
  }

  next();
}


// =====================================================
// ROUTES
// =====================================================

const router = express.Router();

router.use(requireDB);

router.post("/register", async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  if (!name || name.length > 80) {
    return res.status(400).json({ message: "Please enter your name." });
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Please enter a valid email." });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      message: "Password must be at least 8 characters."
    });
  }

  if (await User.exists({ email })) {
    return res.status(409).json({
      message: "An account with this email already exists. Please sign in."
    });
  }

  const user = await User.create({
    name,
    email,
    passwordHash: await bcrypt.hash(password, 10)
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  const user = email ? await User.findOne({ email }) : null;
  const valid = user && (await bcrypt.compare(password, user.passwordHash));

  if (!valid) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get("/me", optionalAuth, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user) {
    return res.status(401).json({ message: "Please sign in to continue." });
  }

  res.json({ user: publicUser(user) });
});

module.exports = {
  authRouter: router,
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireDB
};
