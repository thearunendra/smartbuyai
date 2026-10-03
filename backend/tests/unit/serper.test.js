// serperRequest (retry and errors) and searchShopping (cleaning listings).

const { internals } = require("../../app");
const { mockSerper, shoppingItem, unique } = require("../helpers");

const { serperRequest, searchShopping } = internals;

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

describe("serperRequest", () => {
  test("posts to the endpoint with the key and Indian locale", async () => {
    const fetchMock = mockSerper(() => ({ shopping: [] }));

    await expect(serperRequest("shopping", { q: "tv" })).resolves.toEqual({
      shopping: []
    });

    const [url, options] = fetchMock.mock.calls[0];

    expect(url).toBe("https://google.serper.dev/shopping");
    expect(options.method).toBe("POST");
    expect(options.headers["X-API-KEY"]).toBe("test-serper-key");
    expect(JSON.parse(options.body)).toEqual({ gl: "in", hl: "en", q: "tv" });
  });

  test("retries once after a network error", async () => {
    let calls = 0;
    const fetchMock = mockSerper(() => {
      calls += 1;
      return calls === 1 ? new Error("socket hang up") : { organic: [1] };
    });

    await expect(serperRequest("search", { q: "x" })).resolves.toEqual({
      organic: [1]
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("fails when the retry fails too", async () => {
    const fetchMock = mockSerper(() => new Error("timeout"));

    await expect(serperRequest("search", { q: "x" })).rejects.toThrow("timeout");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("fails on an error status without retrying", async () => {
    const fetchMock = mockSerper(() => ({ ok: false, status: 403 }));

    await expect(serperRequest("search", { q: "x" })).rejects.toThrow(
      "Serper request failed with status 403"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("fails without calling Serper when the key is missing", async () => {
    const saved = process.env.SERPER_API_KEY;
    let request;

    delete process.env.SERPER_API_KEY;
    jest.isolateModules(() => {
      request = require("../../app").internals.serperRequest;
    });
    process.env.SERPER_API_KEY = saved;

    const fetchMock = mockSerper(() => ({}));

    await expect(request("search", { q: "x" })).rejects.toThrow(
      "SERPER_API_KEY is not set."
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("searchShopping", () => {
  test("cleans, de-duplicates and caches listings", async () => {
    const query = unique("phone");
    const fetchMock = mockSerper(() => ({
      shopping: [
        shoppingItem("Phone A", 10000, "amazon.in", { productId: "pa" }),
        shoppingItem("phone a", 9000, "flipkart.com"),
        { title: "", price: "₹500", source: "x" },
        { title: "No price", source: "x" },
        { title: "Free thing", price: "Free", source: "x" },
        { title: "  Phone B  ", price: "₹12,000", source: null }
      ]
    }));

    const listings = await searchShopping(query);

    expect(listings).toEqual([
      {
        id: "pa",
        name: "Phone A",
        price: 10000,
        priceText: "₹10,000",
        store: "Amazon",
        image: "https://img.example/Phone%20A.jpg",
        rating: 4.4,
        reviews: 1200
      },
      {
        id: "2-phone b",
        name: "Phone B",
        price: 12000,
        priceText: "₹12,000",
        store: "Online store",
        image: null,
        rating: null,
        reviews: null
      }
    ]);

    // The second search for the same text is served from the cache.
    await expect(searchShopping(query)).resolves.toEqual(listings);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("an empty response gives no listings", async () => {
    mockSerper(() => ({}));

    await expect(searchShopping(unique("nothing"))).resolves.toEqual([]);
  });
});

describe("serperRequest with a spare key", () => {
  // A fresh module, so the key in use starts from the first one again.
  function withSpareKey() {
    const saved = process.env.SERPER_API_KEY_2;
    let request;

    process.env.SERPER_API_KEY_2 = "spare-serper-key";
    jest.isolateModules(() => {
      request = require("../../app").internals.serperRequest;
    });

    if (saved === undefined) {
      delete process.env.SERPER_API_KEY_2;
    } else {
      process.env.SERPER_API_KEY_2 = saved;
    }

    return request;
  }

  function keyOf(fetchMock, call) {
    return fetchMock.mock.calls[call][1].headers["X-API-KEY"];
  }

  test("switches to the spare when the first is out of credits", async () => {
    const request = withSpareKey();
    let calls = 0;
    const fetchMock = mockSerper(() => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 403 } : { organic: [1] };
    });

    await expect(request("search", { q: "x" })).resolves.toEqual({ organic: [1] });
    expect(keyOf(fetchMock, 0)).toBe("test-serper-key");
    expect(keyOf(fetchMock, 1)).toBe("spare-serper-key");
  });

  test("402 counts as out of credits too, and the spare is kept for later requests", async () => {
    const request = withSpareKey();
    let calls = 0;
    const fetchMock = mockSerper(() => {
      calls += 1;
      return calls === 1 ? { ok: false, status: 402 } : { organic: [calls] };
    });

    await request("search", { q: "a" });
    await request("search", { q: "b" });

    expect(keyOf(fetchMock, 1)).toBe("spare-serper-key");
    expect(keyOf(fetchMock, 2)).toBe("spare-serper-key");
  });

  test("fails once both keys are out of credits", async () => {
    const request = withSpareKey();
    const fetchMock = mockSerper(() => ({ ok: false, status: 403 }));

    await expect(request("search", { q: "x" })).rejects.toThrow(
      "Serper request failed with status 403"
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("another error status does not burn the spare", async () => {
    const request = withSpareKey();
    const fetchMock = mockSerper(() => ({ ok: false, status: 500 }));

    await expect(request("search", { q: "x" })).rejects.toThrow(
      "Serper request failed with status 500"
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
