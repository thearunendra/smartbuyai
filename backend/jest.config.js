// Fake timers in the cache tests are intended; Mongoose warns about them.
process.env.SUPPRESS_JEST_WARNINGS = "true";

module.exports = {
  testEnvironment: "node",
  setupFiles: ["<rootDir>/tests/setup-env.js"],
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  // In-memory MongoDB can take a while to start the first time.
  testTimeout: 30000,
  restoreMocks: true,
  clearMocks: true,
  collectCoverageFrom: [
    "app.js",
    "auth.js",
    "cache.js",
    "chats.js",
    "db.js",
    "security.js",
    "wishlist.js"
  ],
  coverageReporters: ["text", "text-summary", "html", "json-summary"],
  // White-box targets: the run fails if coverage drops below these.
  coverageThreshold: {
    global: { statements: 90, branches: 85, functions: 90, lines: 90 }
  },
  coverageDirectory: "coverage"
};
