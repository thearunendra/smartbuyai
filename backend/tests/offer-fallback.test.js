process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test-gemini-key";
process.env.SERPER_API_KEY = process.env.SERPER_API_KEY || "test-serper-key";

const {
  internals
} = require("../app");

describe("conservative merchant-offer fallback", () => {
  const productName =
    "Godrej 1.5 Ton 3 Star Inverter Split AC 5-in-1 Convertible";

  const matchingPage = {
    index: 0,
    title: "Godrej 1.5 Ton 3 Star Inverter Split AC 5-in-1 Convertible",
    url: "https://www.amazon.in/Godrej-1-5-Ton-3-Star-Inverter/dp/example",
    snippet: "Godrej 1.5 Ton 3 Star Inverter Split AC available for ₹37,903."
  };

  test("accepts a trusted merchant page that matches the exact product tokens", () => {
    expect(internals.exactMerchantPageMatch(productName, matchingPage)).toBe(true);
  });

  test("rejects a page for a different star rating/model variant", () => {
    const differentVariant = {
      ...matchingPage,
      title: "Godrej 1.5 Ton 5 Star Inverter Split AC",
      url: "https://www.amazon.in/Godrej-1-5-Ton-5-Star-Inverter/dp/example"
    };

    expect(internals.exactMerchantPageMatch(productName, differentVariant)).toBe(false);
  });

  test("extracts a price only when one currency-marked amount is unambiguous", () => {
    expect(internals.priceFromMerchantSnippet("Available today for ₹37,903.")).toBe(37903);
    expect(internals.priceFromMerchantSnippet("₹37,903 or ₹40,000 with exchange")).toBe(null);
    expect(internals.priceFromMerchantSnippet("Price starts at 37,903")).toBe(null);
  });

  test("returns unique trusted retailer pages and ignores untrusted sellers", () => {
    const offers = internals.fallbackOffersFromMerchantPages({
      name: productName,
      pages: [
        matchingPage,
        {
          ...matchingPage,
          index: 1,
          title: "Godrej 1.5 Ton 3 Star Inverter Split AC 5-in-1 Convertible",
          url: "https://www.amazon.in/Godrej-1-5-Ton-3-Star-Inverter/dp/duplicate",
          snippet: "Available for ₹37,903."
        },
        {
          ...matchingPage,
          index: 2,
          title: "Godrej 1.5 Ton 3 Star Inverter Split AC 5-in-1 Convertible",
          url: "https://www.flipkart.com/godrej-1-5-ton-3-star-inverter-ac/p/example",
          snippet: "Buy now for Rs. 38,499."
        },
        {
          ...matchingPage,
          index: 3,
          title: "Godrej 1.5 Ton 3 Star Inverter Split AC 5-in-1 Convertible",
          url: "https://unknown-market.example/product",
          snippet: "Available for ₹35,000."
        }
      ]
    });

    expect(offers).toEqual([
      {
        store: "Amazon",
        price: 37903,
        link: matchingPage.url
      },
      {
        store: "Flipkart",
        price: 38499,
        link: "https://www.flipkart.com/godrej-1-5-ton-3-star-inverter-ac/p/example"
      }
    ]);
  });
});
