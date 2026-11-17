const {
  trustedStoreFromUrl,
  trustedMerchantUrl
} = require("../../merchant-urls");

describe("trusted merchant URL policy", () => {
  test.each([
    ["https://www.amazon.in/product", "Amazon"],
    ["https://shop.flipkart.com/product", "Flipkart"],
    ["https://store.croma.com/product", "Croma"],
    ["https://amazon.in.attacker.example/product", null],
    ["http://amazon.in/product", null],
    ["https://user:pass@amazon.in/product", null],
    ["javascript:alert(1)", null],
    ["not a URL", null]
  ])("recognizes only HTTPS merchant domains: %s", (url, expected) => {
    expect(trustedStoreFromUrl(url)).toBe(expected);
  });

  test("returns canonical HTTPS links only for known merchants", () => {
    expect(trustedMerchantUrl("https://amazon.in/product/123"))
      .toBe("https://amazon.in/product/123");
    expect(trustedMerchantUrl("https://evil.example/product")).toBeNull();
    expect(trustedMerchantUrl("javascript:alert(1)")).toBeNull();
  });
});
