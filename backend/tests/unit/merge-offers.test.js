// mergeOffers: matching the listed store, outlier removal and sorting.

const { internals } = require("../../app");

const { mergeOffers } = internals;

const product = { name: "Phone", store: "Amazon", price: 1000 };

describe("mergeOffers", () => {
  test("a matching store with a higher price gets the listing price", () => {
    const result = mergeOffers(product, [
      { store: "Amazon.in", price: 1200, link: "https://amazon.in/p" }
    ]);

    expect(result).toEqual([
      { store: "Amazon.in", price: 1000, link: "https://amazon.in/p" }
    ]);
  });

  test("a matching store without a price gets the listing price", () => {
    const result = mergeOffers(product, [
      { store: "Amazon", price: null, link: "https://amazon.in/p" }
    ]);

    expect(result[0].price).toBe(1000);
  });

  test("a matching store with a lower price keeps its price", () => {
    const result = mergeOffers(product, [
      { store: "Amazon", price: 900, link: "https://amazon.in/p" }
    ]);

    expect(result).toEqual([
      { store: "Amazon", price: 900, link: "https://amazon.in/p" }
    ]);
  });

  test("the store name matches in both directions", () => {
    const result = mergeOffers(
      { name: "TV", store: "Reliance Digital", price: 500 },
      [{ store: "Reliance", price: 700, link: "https://r.in" }]
    );

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(500);
  });

  test("without a match the listing is added without a link", () => {
    const result = mergeOffers(product, [
      { store: "Flipkart", price: 1100, link: "https://flipkart.com/p" }
    ]);

    expect(result).toEqual([
      { store: "Amazon", price: 1000, link: null },
      { store: "Flipkart", price: 1100, link: "https://flipkart.com/p" }
    ]);
  });

  test("with 3+ prices, prices below half the median are dropped", () => {
    const result = mergeOffers(product, [
      { store: "Flipkart", price: 1050, link: "f" },
      { store: "Croma", price: 400, link: "c" },
      { store: "Tata CLiQ", price: 1100, link: "t" }
    ]);

    expect(result.map((offer) => offer.store)).toEqual([
      "Amazon",
      "Flipkart",
      "Tata CLiQ"
    ]);
  });

  test("with fewer than 3 prices nothing is dropped", () => {
    const result = mergeOffers(product, [{ store: "Flipkart", price: 300, link: "f" }]);

    expect(result.map((offer) => offer.price)).toEqual([300, 1000]);
  });

  test("offers without a price stay and are sorted last", () => {
    const result = mergeOffers(product, [
      { store: "Croma", price: null, link: "c" },
      { store: "Flipkart", price: 1100, link: "f" },
      { store: "Vijay Sales", price: 1050, link: "v" }
    ]);

    expect(result.map((offer) => offer.store)).toEqual([
      "Amazon",
      "Vijay Sales",
      "Flipkart",
      "Croma"
    ]);
  });

  test("an empty offer list gives just the listing", () => {
    expect(mergeOffers(product, [])).toEqual([
      { store: "Amazon", price: 1000, link: null }
    ]);
  });
});
