const { Redis } = require("@upstash/redis");

// Cached results are served for this long before Serper is called again.
const CACHE_TTL_SECONDS = 6 * 60 * 60;

// Recent entries are also kept in memory so repeat reads skip the network.
const MEMORY_LIMIT = 500;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    : null;

const memory = new Map();

function cacheKey(prefix, text) {
  return `smartbuy:${prefix}:${text.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

function getMemory(key) {
  const entry = memory.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expires) {
    memory.delete(key);
    return null;
  }

  return entry.value;
}

function setMemory(key, value, expires) {
  memory.delete(key);
  memory.set(key, { value, expires });

  // Map keeps insertion order, so the first key is the oldest.
  if (memory.size > MEMORY_LIMIT) {
    memory.delete(memory.keys().next().value);
  }
}

async function getCached(key) {
  const local = getMemory(key);

  if (local !== null) {
    return local;
  }

  if (!redis) {
    return null;
  }

  try {
    const [value, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);

    if (value === null || value === undefined) {
      return null;
    }

    setMemory(key, value, Date.now() + Math.max(ttl, 1) * 1000);

    return value;
  } catch (error) {
    console.log("Redis Error:", error.message);
    return null;
  }
}

async function setCached(key, value) {
  setMemory(key, value, Date.now() + CACHE_TTL_SECONDS * 1000);

  if (!redis) {
    return;
  }

  try {
    await redis.set(key, value, { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.log("Redis Error:", error.message);
  }
}

module.exports = {
  cacheKey,
  getCached,
  setCached,
  cacheMode: redis ? "Upstash Redis" : "in-memory (UPSTASH_REDIS_* not set)"
};
