const { GuestSearchStore } = require("../security");

describe("GuestSearchStore", () => {
  test("uses a hashed IP key and a fixed Redis expiry", async () => {
    const redis = {
      set: jest.fn().mockResolvedValue("OK"),
      incr: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(86400)
    };
    const store = new GuestSearchStore(redis);
    store.init({ windowMs: 24 * 60 * 60 * 1000 });

    const result = await store.increment("203.0.113.42");

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringMatching(/^smartbuy:rate-limit:guest-search:[a-f0-9]{64}$/),
      "0",
      { nx: true, ex: 86400 }
    );
    expect(redis.set.mock.calls[0][0]).not.toContain("203.0.113.42");
    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  test("falls back to a local rolling window when Redis is unavailable", async () => {
    const store = new GuestSearchStore(null);
    store.init({ windowMs: 60_000 });

    expect((await store.increment("guest-ip")).totalHits).toBe(1);
    expect((await store.increment("guest-ip")).totalHits).toBe(2);

    await store.resetKey("guest-ip");

    expect((await store.increment("guest-ip")).totalHits).toBe(1);
  });

  test("expires local fallback counts after the configured window", async () => {
    jest.useFakeTimers();
    try {
      const store = new GuestSearchStore(null);
      store.init({ windowMs: 60_000 });

      expect((await store.increment("guest-ip")).totalHits).toBe(1);
      jest.advanceTimersByTime(60_001);
      expect((await store.increment("guest-ip")).totalHits).toBe(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
