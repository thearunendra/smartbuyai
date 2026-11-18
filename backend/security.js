const crypto = require("node:crypto");
const cors = require("cors");
const helmet = require("helmet");
const { Redis } = require("@upstash/redis");
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

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

// Guest trial counts are stored in Redis when it is available. The local
// fallback keeps the guest endpoint usable during a temporary Redis outage.
// IP values are hashed before being used as Redis keys.
class GuestSearchStore {
  constructor(redisClient = redis) {
    this.redis = redisClient;
    this.windowMs = 24 * 60 * 60 * 1000;
    this.prefix = "smartbuy:rate-limit:guest-search";
    this.local = new Map();
    this.lastRedisWarningAt = 0;
  }

  init(options) {
    if (Number.isFinite(options?.windowMs) && options.windowMs > 0) {
      this.windowMs = options.windowMs;
    }
  }

  redisKey(key) {
    const digest = crypto.createHash("sha256").update(String(key)).digest("hex");
    return `${this.prefix}:${digest}`;
  }

  incrementLocal(key) {
    const now = Date.now();
    const current = this.local.get(key);
    const entry = current && current.resetTime > now
      ? current
      : { totalHits: 0, resetTime: now + this.windowMs };

    entry.totalHits += 1;
    this.local.set(key, entry);

    // Opportunistically prune expired fallback entries.
    for (const [storedKey, value] of this.local) {
      if (value.resetTime <= now) this.local.delete(storedKey);
    }

    return {
      totalHits: entry.totalHits,
      resetTime: new Date(entry.resetTime)
    };
  }

  async increment(key) {
    if (this.redis) {
      try {
        const redisKey = this.redisKey(key);
        const ttlSeconds = Math.max(1, Math.ceil(this.windowMs / 1000));

        // Create the counter with its expiry before incrementing it. This
        // avoids a permanent key if a process stops between INCR and EXPIRE.
        await this.redis.set(redisKey, "0", { nx: true, ex: ttlSeconds });
        const totalHits = Number(await this.redis.incr(redisKey));
        const remainingSeconds = Number(await this.redis.ttl(redisKey));

        return {
          totalHits,
          resetTime: new Date(Date.now() + Math.max(1, remainingSeconds) * 1000)
        };
      } catch (error) {
        const now = Date.now();
        if (now - this.lastRedisWarningAt > 60_000) {
          console.warn("Guest rate-limit Redis unavailable; using local fallback:", error.message);
          this.lastRedisWarningAt = now;
        }
      }
    }

    return this.incrementLocal(key);
  }

  async decrement(key) {
    if (this.redis) {
      try {
        const redisKey = this.redisKey(key);
        await this.redis.decr(redisKey);
        return;
      } catch (error) {
        // Keep the local fallback best-effort if Redis becomes unavailable.
      }
    }

    const current = this.local.get(key);
    if (current) {
      current.totalHits = Math.max(0, current.totalHits - 1);
      this.local.set(key, current);
    }
  }

  async resetKey(key) {
    if (this.redis) {
      try {
        await this.redis.del(this.redisKey(key));
      } catch (error) {
        // A reset must still clear the local fallback.
      }
    }
    this.local.delete(key);
  }

  async resetAll() {
    this.local.clear();
  }
}

const guestSearchStore = new GuestSearchStore();

function limiter({ windowMs, limit, message, byUser = false, store }) {
  return rateLimit({
    windowMs,
    limit,
    ...(store ? { store } : {}),
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

// Anonymous AI searches: two free trials per IP address per rolling day.
// Redis shares the counter across restarts and backend instances.
const guestSearchLimiter = limiter({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 2,
  store: guestSearchStore,
  message: "You've used your 2 free AI searches for today. Sign in to continue."
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
  guestSearchLimiter,
  guestSearchStore,
  GuestSearchStore,
  allowedOrigins
};
