// Budget, price and store-name parsing: every branch and regex alternative.

const { internals } = require("../../app");

const { toRupees, extractBudget, parsePrice, storeName } = internals;

describe("toRupees", () => {
  test.each([
    ["20000", undefined, 20000],
    ["20,000", undefined, 20000],
    ["20", "k", 20000],
    ["15", "thousand", 15000],
    ["1.5", "lakh", 150000],
    ["2", "lac", 200000],
    ["3", "l", 300000]
  ])("%s %s -> %i", (amount, unit, expected) => {
    expect(toRupees(amount, unit)).toBe(expected);
  });
});

describe("extractBudget", () => {
  test.each([
    ["phone under 20000", 20000],
    ["laptop below 60k", 60000],
    ["tv less than ₹45,000", 45000],
    ["earbuds within rs. 3000", 3000],
    ["watch within rs 2500", 2500],
    ["shoes upto 4k", 4000],
    ["bag up to inr 1500", 1500],
    ["max 15 thousand", 15000],
    ["maximum 2 lac", 200000],
    ["budget of 1.5 lakh", 150000],
    ["budget is 50000", 50000],
    ["budget 900", 900],
    ["UNDER 30K PHONE", 30000]
  ])("%s -> %i", (query, expected) => {
    expect(extractBudget(query)).toBe(expected);
  });

  test("returns null when there is no budget", () => {
    expect(extractBudget("best camera phone")).toBeNull();
    expect(extractBudget("under budget")).toBeNull();
  });
});

describe("parsePrice", () => {
  test.each([
    ["₹1,299.00", 1299],
    ["₹1,34,900", 134900],
    ["Rs. 499", 499],
    ["99.5", 100],
    [750, 750],
    ["₹1,299 - ₹1,499", 1299]
  ])("%s -> %i", (text, expected) => {
    expect(parsePrice(text)).toBe(expected);
  });

  test.each([null, undefined, "", "Free", "₹0"])(
    "%s -> null",
    (text) => {
      expect(parsePrice(text)).toBeNull();
    }
  );
});

describe("storeName", () => {
  test.each([
    ["amazon.in", "Amazon"],
    ["Mi.com", "Mi"],
    ["shop.co.in", "Shop"],
    ["  flipkart  ", "Flipkart"],
    ["Croma", "Croma"],
    [null, "Online store"],
    ["", "Online store"]
  ])("%s -> %s", (source, expected) => {
    expect(storeName(source)).toBe(expected);
  });
});
