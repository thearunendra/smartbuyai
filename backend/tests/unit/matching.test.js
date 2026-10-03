// Name matching and cleaning helpers used by price comparison and the
// details page.

const { internals } = require("../../app");

const {
  modelCodes,
  mentionsModel,
  normalizeName,
  nameTokens,
  closestListing,
  isNewListing,
  cleanText,
  cleanScore
} = internals;

describe("modelCodes", () => {
  test("keeps tokens of 5+ characters with letters and digits", () => {
    expect(modelCodes("ASUS TUF Gaming FX507VV Laptop")).toEqual(["fx507vv"]);
    expect(modelCodes("HP 15s-fb3124AX")).toEqual(["fb3124ax"]);
  });

  test("ignores short, letter-only and digit-only tokens", () => {
    expect(modelCodes("Apple iPhone 15 128 GB")).toEqual([]);
    expect(modelCodes("Sony 55 inch 4K 123456")).toEqual([]);
  });

  test("storage written as one word counts, so pages must match the configuration", () => {
    expect(modelCodes("Apple iPhone 15 128GB")).toEqual(["128gb"]);
  });
});

describe("mentionsModel", () => {
  const page = { title: "ASUS TUF FX507-VV review", url: "https://shop.in/item" };

  test("any page matches when there are no codes", () => {
    expect(mentionsModel(page, [])).toBe(true);
  });

  test("matches codes in the title ignoring punctuation", () => {
    expect(mentionsModel(page, ["fx507vv"])).toBe(true);
  });

  test("matches codes in the URL", () => {
    expect(
      mentionsModel({ title: "Laptop", url: "https://x.in/fb3124ax" }, ["fb3124ax"])
    ).toBe(true);
  });

  test("rejects pages without any code", () => {
    expect(mentionsModel(page, ["fa506nc"])).toBe(false);
  });
});

describe("normalizeName and nameTokens", () => {
  test("normalizeName keeps lowercase letters and digits", () => {
    expect(normalizeName("Galaxy S24+ (5G)")).toBe("galaxys245g");
  });

  test("nameTokens splits on anything else", () => {
    expect(nameTokens("Apple iPhone 15 (128 GB) - Black")).toEqual([
      "apple",
      "iphone",
      "15",
      "128",
      "gb",
      "black"
    ]);
  });
});

describe("closestListing", () => {
  const listings = [
    { name: "Apple iPhone 15 Pro Max" },
    { name: "Apple iPhone 15" },
    { name: "Apple iPhone 15 Pro" }
  ];

  test("prefers the listing without extra words", () => {
    expect(closestListing("Apple iPhone 15 Black", listings).name).toBe(
      "Apple iPhone 15"
    );
  });

  test("keeps the first listing on a tie", () => {
    expect(closestListing("Phone", [{ name: "A" }, { name: "B" }]).name).toBe("A");
  });

  test("returns null for no listings", () => {
    expect(closestListing("Anything", [])).toBeNull();
  });
});

describe("isNewListing", () => {
  test.each([
    [{ name: "iPhone 15", store: "Amazon" }, true],
    [{ name: "Reused bottle", store: "Amazon" }, true],
    [{ name: "iPhone 15 (Refurbished)", store: "Amazon" }, false],
    [{ name: "Pixel 8 Renewed", store: "Amazon" }, false],
    [{ name: "OnePlus 12 Good Condition", store: "Buy" }, false],
    [{ name: "Pre-owned Galaxy", store: "Amazon" }, false],
    [{ name: "iPhone 15", store: "Cashify" }, false],
    [{ name: "iPhone 15", store: "Refit Global" }, false],
    [{ name: "iPhone 15", store: "CeX" }, false]
  ])("%o -> %s", (item, expected) => {
    expect(isNewListing(item)).toBe(expected);
  });
});

describe("cleanText", () => {
  test("trims and cuts strings", () => {
    expect(cleanText("  hello world  ", 5)).toBe("hello");
  });

  test("turns other values into an empty string", () => {
    expect(cleanText(42, 10)).toBe("");
    expect(cleanText(null, 10)).toBe("");
  });
});

describe("cleanScore", () => {
  test.each([
    [7.25, 7.3],
    [8, 8],
    [12, 10],
    [-3, 0],
    ["8", null],
    [Number.NaN, null],
    [undefined, null]
  ])("%s -> %s", (value, expected) => {
    expect(cleanScore(value)).toBe(expected);
  });
});
