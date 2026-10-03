// cache.js: the in-memory layer (expiry, size limit) and the Redis layer
// (hit, miss, remaining TTL, errors). Redis is the mock in __mocks__.

const SIX_HOURS = 6 * 60 * 60 * 1000;

// A fresh copy of cache.js, with or without Redis configured.
function loadCache({ redis = false } = {}) {
  let loaded;

  if (redis) {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
  }

  jest.isolateModules(() => {
    const cache = require("../../cache");
    const { Redis } = require("@upstash/redis");

    loaded = { ...cache, client: Redis.instances.at(-1) };
  });

  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;

  return loaded;
}

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

describe("cacheKey", () => {
  test("lowercases and collapses spaces", () => {
    const { cacheKey } = loadCache();

    expect(cacheKey("shopping", "  iPhone   15 PRO ")).toBe(
      "smartbuy:shopping:iphone 15 pro"
    );
  });
});

describe("memory cache (no Redis)", () => {
  test("reports the in-memory mode", () => {
    expect(loadCache().cacheMode).toMatch(/in-memory/);
  });

  test("returns null for a missing key and the value after setting it", async () => {
    const { getCached, setCached } = loadCache();

    expect(await getCached("k1")).toBeNull();

    await setCached("k1", { a: 1 });

    expect(await getCached("k1")).toEqual({ a: 1 });
  });

  test("entries expire after 6 hours", async () => {
    jest.useFakeTimers();

    const { getCached, setCached } = loadCache();

    await setCached("k2", "value");
    jest.advanceTimersByTime(SIX_HOURS - 1000);
    expect(await getCached("k2")).toBe("value");

    jest.advanceTimersByTime(2000);
    expect(await getCached("k2")).toBeNull();
  });

  test("keeps at most 500 entries, dropping the oldest", async () => {
    const { getCached, setCached } = loadCache();

    for (let i = 0; i < 500; i += 1) {
      await setCached(`key-${i}`, i);
    }

    // Setting key-0 again makes it the newest, so key-1 is dropped next.
    await setCached("key-0", "again");
    await setCached("key-500", 500);

    expect(await getCached("key-0")).toBe("again");
    expect(await getCached("key-1")).toBeNull();
    expect(await getCached("key-2")).toBe(2);
    expect(await getCached("key-500")).toBe(500);
  });
});

describe("Redis cache", () => {
  test("reports the Redis mode and passes the credentials", () => {
    const { cacheMode, client } = loadCache({ redis: true });

    expect(cacheMode).toBe("Upstash Redis");
    expect(client.options).toEqual({ url: "https://redis.test", token: "token" });
  });

  test("writes to Redis with a 6 hour expiry", async () => {
    const { setCached, client } = loadCache({ redis: true });

    await setCached("r1", "v");

    expect(client.set).toHaveBeenCalledWith("r1", "v", { ex: 21600 });
  });

  test("a Redis hit is kept in memory for the remaining TTL", async () => {
    jest.useFakeTimers();

    const { getCached, client } = loadCache({ redis: true });

    client.store.set("r2", { value: "from redis", ttl: 100 });

    expect(await getCached("r2")).toBe("from redis");
    expect(await getCached("r2")).toBe("from redis");
    expect(client.get).toHaveBeenCalledTimes(1);

    // After the TTL the memory copy expires and Redis is asked again.
    jest.advanceTimersByTime(101 * 1000);
    await getCached("r2");
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  test("a TTL below 1 second is treated as 1 second", async () => {
    jest.useFakeTimers();

    const { getCached, client } = loadCache({ redis: true });

    client.store.set("r3", { value: "v", ttl: -1 });

    await getCached("r3");
    jest.advanceTimersByTime(500);
    await getCached("r3");
    expect(client.get).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    await getCached("r3");
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  test("a Redis miss returns null", async () => {
    const { getCached } = loadCache({ redis: true });

    expect(await getCached("missing")).toBeNull();
  });

  test("Redis read errors are logged and treated as a miss", async () => {
    const { getCached, client } = loadCache({ redis: true });

    client.get.mockRejectedValueOnce(new Error("network down"));

    expect(await getCached("r4")).toBeNull();
    expect(console.log).toHaveBeenCalledWith("Redis Error:", "network down");
  });

  test("Redis write errors don't break the caller and memory still works", async () => {
    const { getCached, setCached, client } = loadCache({ redis: true });

    client.set.mockRejectedValueOnce(new Error("quota exceeded"));

    await expect(setCached("r5", "kept")).resolves.toBeUndefined();
    expect(await getCached("r5")).toBe("kept");
  });
});
