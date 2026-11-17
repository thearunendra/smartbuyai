const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { User, isDBReady } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_SECRET_IS_VALID = Buffer.byteLength(JWT_SECRET, "utf8") >= 32;
const TOKEN_EXPIRY = "7d";
const MIN_PASSWORD_BYTES = 8;
const MAX_BCRYPT_PASSWORD_BYTES = 72;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(
  "SmartBuy AI dummy password comparison",
  10
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!JWT_SECRET_IS_VALID) {
  console.log("Auth: JWT_SECRET must be at least 32 bytes (sign-in disabled)");
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
  return jwt.sign(
    { sub: user.id },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY, algorithm: "HS256" }
  );
}


// =====================================================
// MIDDLEWARE
// =====================================================

// Sets req.userId only when a correctly signed, correctly shaped token is sent.
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";

  if (JWT_SECRET_IS_VALID && header.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(
        header.slice(7),
        JWT_SECRET,
        { algorithms: ["HS256"] }
      );

      if (
        payload &&
        typeof payload === "object" &&
        typeof payload.sub === "string" &&
        /^[a-f\d]{24}$/i.test(payload.sub)
      ) {
        req.userId = payload.sub;
      }
    } catch {
      // Expired, malformed or incorrectly signed tokens remain unauthenticated.
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
  if (!isDBReady() || !JWT_SECRET_IS_VALID) {
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
  const passwordBytes = Buffer.byteLength(password, "utf8");

  if (!name || name.length > 80) {
    return res.status(400).json({ message: "Please enter your name." });
  }

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Please enter a valid email." });
  }

  if (
    passwordBytes < MIN_PASSWORD_BYTES ||
    passwordBytes > MAX_BCRYPT_PASSWORD_BYTES
  ) {
    return res.status(400).json({
      message: "Password must be between 8 and 72 UTF-8 bytes."
    });
  }

  if (await User.exists({ email })) {
    return res.status(409).json({
      message: "An account with this email already exists. Please sign in."
    });
  }

  let user;

  try {
    user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10)
    });
  } catch (error) {
    // A concurrent registration can win after the existence check.
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists. Please sign in."
      });
    }

    throw error;
  }

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const email =
    typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password =
    typeof req.body.password === "string" ? req.body.password : "";
  const passwordBytes = Buffer.byteLength(password, "utf8");
  const passwordWithinBcryptLimit =
    passwordBytes > 0 && passwordBytes <= MAX_BCRYPT_PASSWORD_BYTES;

  const user = email ? await User.findOne({ email }) : null;
  const hash = user?.passwordHash || DUMMY_PASSWORD_HASH;
  const comparablePassword = passwordWithinBcryptLimit
    ? password
    : "invalid-password-length";
  const passwordMatches = await bcrypt.compare(comparablePassword, hash);

  if (!user || !passwordWithinBcryptLimit || !passwordMatches) {
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
