// TEMPORARY (2026-10-03): snapshot of the white-box test results, shown on the
// admin dashboard for the project demo. Nothing reads this at runtime except
// TestingPanel, so deleting both files removes the feature.
//
// To refresh after changing the suites, run `npm run test:coverage` in backend/
// and frontend/ and copy the summary numbers below.

export const TESTING_SNAPSHOT_DATE = "3 Oct 2026";

// The run fails if coverage drops below these (backend/jest.config.js and the
// `test.coverage.thresholds` block in frontend/vite.config.js).
export const COVERAGE_THRESHOLDS = {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90
};

export const TEST_SUITES = [
  {
    name: "Backend",
    stack: "Jest + Supertest, in-memory MongoDB",
    files: 16,
    tests: 239,
    coverage: {
      statements: { percent: 98.63, covered: 724, total: 734 },
      branches: { percent: 93.64, covered: 457, total: 488 },
      functions: { percent: 99.33, covered: 150, total: 151 },
      lines: { percent: 98.87, covered: 706, total: 714 }
    }
  },
  {
    name: "Frontend",
    stack: "Vitest + Testing Library, jsdom",
    files: 16,
    tests: 190,
    coverage: {
      statements: { percent: 97.75, covered: 783, total: 801 },
      branches: { percent: 94.3, covered: 629, total: 667 },
      functions: { percent: 96.28, covered: 259, total: 269 },
      lines: { percent: 98.36, covered: 720, total: 732 }
    }
  }
];

// Defects the tests found in code that was already live, all since fixed.
export const BUGS_FOUND = [
  {
    title: "\u201cunder 15 thousand\u201d was read as \u20b915 lakh",
    detail:
      "The `thousand` branch of extractBudget was unreachable \u2013 the lakh " +
      "pattern matched first, so a \u20b915,000 budget became \u20b915,00,000."
  },
  {
    title: "\u201cRs. 499\u201d was read as \u20b90",
    detail:
      "parsePrice only accepted the \u20b9 symbol, and a price range like " +
      "\u201c\u20b91,299 - \u20b91,499\u201d was glued into 12991499."
  },
  {
    title: "Store names ending \u201c.co.in\u201d kept the \u201c.co\u201d",
    detail: "storeName turned flipkart.co.in into \u201cFlipkart.co\u201d."
  }
];
