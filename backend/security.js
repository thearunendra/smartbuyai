const cors = require("cors");
const helmet = require("helmet");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

// Frontend addresses allowed to call the API (comma-separated), e.g.
// CORS_ORIGINS=https://smartbuy-ai.onrender.com,http://localhost:5173
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsMiddleware = cors({
  origin(origin, callback) {
    // Requests without an Origin header (curl, server-to-server) are allowed;
    // browsers always send one.
    callback(null, !origin || allowedOrigins.includes(origin));
  }
});

function limiter({ windowMs, limit, message, byUser = false }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // Signed-in routes count per user, others per IP address.
    keyGenerator: (req) =>
      byUser && req.userId ? `user:${req.userId}` : ipKeyGenerator(req.ip),
    handler: (req, res) => res.status(429).json({ message })
  });
}

// Sign-in and sign-up: slows down password guessing.
const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: "Too many sign-in attempts. Please try again in 15 minutes."
});

// AI searches: each one uses Serper credits and Gemini quota.
const searchLimiter = limiter({
  windowMs: 60 * 1000,
  limit: 10,
  byUser: true,
  message: "You're searching too fast. Please wait a minute and try again."
});

// Everything else under /api.
const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  message: "Too many requests. Please try again later."
});

function applySecurity(app) {
  // Render (and most hosts) sit behind one proxy; needed for real client IPs.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(corsMiddleware);
  app.use("/api", apiLimiter);
  app.use(["/api/auth/login", "/api/auth/register"], authLimiter);
}

module.exports = {
  applySecurity,
  searchLimiter,
  allowedOrigins
};
