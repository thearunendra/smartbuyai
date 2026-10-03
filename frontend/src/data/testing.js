// TEMPORARY (2026-10-03): test-coverage snapshot for the admin dashboard.
// Refresh by hand from `npm run test:coverage` in backend/ and frontend/.
export const TESTING_SNAPSHOT_DATE = "3 Oct 2026";

// Statement coverage at or above this counts as safe (the runners' own
// threshold: see backend/jest.config.js and frontend/vite.config.js).
export const SAFE_PERCENT = 90;

export const TEST_SUITES = [
  { name: "Backend", statements: 98.7 },
  { name: "Frontend", statements: 97.8 }
];
