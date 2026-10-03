// Runs before every test file, before any app code is loaded. Tests never
// read backend/.env, so they can't reach real services or spend credits.

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.GEMINI_API_KEY = "test-gemini-key";
process.env.SERPER_API_KEY = "test-serper-key";
process.env.CORS_ORIGINS = "http://localhost:5173";
// Mocked Gemini calls don't need the free-tier limit.
process.env.GEMINI_RPM = "1000";

delete process.env.MONGODB_URI;
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
