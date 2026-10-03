// In-memory stand-in for Upstash Redis. Only used when a test sets the
// UPSTASH_* variables; Redis.instances gives tests the client cache.js made.

class Redis {
  constructor(options) {
    this.options = options;
    this.store = new Map();
    this.get = jest.fn(async (key) =>
      this.store.has(key) ? this.store.get(key).value : null
    );
    this.ttl = jest.fn(async (key) =>
      this.store.has(key) ? this.store.get(key).ttl : -2
    );
    this.set = jest.fn(async (key, value, { ex } = {}) => {
      this.store.set(key, { value, ttl: ex ?? -1 });
      return "OK";
    });

    Redis.instances.push(this);
  }
}

Redis.instances = [];

module.exports = { Redis };
