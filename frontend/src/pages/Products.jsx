import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpDown, Check, PackageSearch, Search, SlidersHorizontal, X } from "lucide-react";
import Navbar from "../components/Navbar";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import CategoryTabs from "../components/CategoryTabs";
import { API_URL } from "../config";
import { api } from "../api";
import { useAuth } from "../auth";
import {
  DEPARTMENTS,
  findCategory,
  findDepartment
} from "../data/categories";
import "./Products.css";

// ?category=Sofas selects that product type (and its department);
// ?department=Furniture selects the department's first product type.
function resolveSelection(searchParams) {
  const category = findCategory(searchParams.get("category"));

  if (category) {
    return { department: findDepartment(category.department), category: category.name };
  }

  const department =
    findDepartment(searchParams.get("department")) || DEPARTMENTS[0];

  return { department, category: department.categories[0].name };
}

function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { department, category } = resolveSelection(searchParams);

  const query = searchParams.get("q") || "";

  const params = new URLSearchParams({ category });

  if (query) {
    params.set("q", query);
  }

  const requestKey = params.toString();

  const [result, setResult] = useState({
    key: null,
    products: [],
    error: ""
  });
  const [search, setSearch] = useState(query);
  const [sort, setSort] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [brandFilter, setBrandFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareNotice, setCompareNotice] = useState("");
  const [savedNames, setSavedNames] = useState([]);
  const [wishlistBusy, setWishlistBusy] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setSavedNames([]);
      return;
    }

    let ignore = false;
    api("/api/wishlist")
      .then((data) => {
        if (!ignore) setSavedNames((data.items || []).map((item) => item.name));
      })
      .catch(() => {
        if (!ignore) setSavedNames([]);
      });

    return () => { ignore = true; };
  }, [user]);

  // Loading until the response for the current category/search arrives.
  const loading = result.key !== requestKey;
  const { products, error } = result;

  useEffect(() => {
    let ignore = false;

    fetch(`${API_URL}/api/products?${requestKey}`)
      .then((response) => response.json())
      .then((data) => {
        if (!ignore) {
          setResult({
            key: requestKey,
            products: data.products || [],
            checkedAt: data.checkedAt || null,
            error: data.products?.length ? "" : data.message || ""
          });
        }
      })
      .catch((error) => {
        console.log("Unable to load products:", error);

        if (!ignore) {
          setResult({
            key: requestKey,
            products: [],
            error: "Unable to connect to SmartBuy AI."
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [requestKey]);

  const submitSearch = (e) => {
    e.preventDefault();

    const params = { category };

    if (search.trim()) {
      params.q = search.trim();
    }

    setSearchParams(params);
  };

  const changeCategory = (value) => {
    setSearch("");
    setSearchParams({ category: value });
  };

  const changeDepartment = (value) => {
    setSearch("");
    setSearchParams({ department: value });
  };

  const sortedProducts = [...products];

  if (sort === "low") {
    sortedProducts.sort((a, b) => a.price - b.price);
  }

  if (sort === "high") {
    sortedProducts.sort((a, b) => b.price - a.price);
  }

  if (sort === "rating") {
    sortedProducts.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  const brands = useMemo(
    () => [...new Set(products.map((item) => item.brand || item.name?.split(" ")[0]).filter(Boolean))].sort(),
    [products]
  );
  const stores = useMemo(
    () => [...new Set(products.flatMap((item) => [item.store, ...(item.offers || []).map((offer) => offer.store)]).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = sortedProducts.filter((product) => {
    const price = Number(product.price) || 0;
    const brand = product.brand || product.name?.split(" ")[0] || "";
    const storeNames = [product.store, ...(product.offers || []).map((offer) => offer.store)];
    return (
      (!brandFilter || brand === brandFilter) &&
      (!storeFilter || storeNames.includes(storeFilter)) &&
      (!minPrice || price >= Number(minPrice)) &&
      (!maxPrice || price <= Number(maxPrice)) &&
      (!minRating || (Number(product.rating) || 0) >= Number(minRating))
    );
  });

  const activeFilterCount = [brandFilter, storeFilter, minPrice, maxPrice, minRating].filter(Boolean).length;

  const toggleCompare = (product) => {
    const key = product.id || product.name;
    setSelectedForCompare((current) => {
      const exists = current.some((item) => (item.id || item.name) === key);
      if (exists) {
        setCompareNotice("");
        return current.filter((item) => (item.id || item.name) !== key);
      }
      if (current.length >= 4) {
        setCompareNotice("You can compare up to 4 products at a time.");
        return current;
      }
      setCompareNotice("");
      return [...current, product];
    });
  };

  const toggleWishlist = async (product) => {
    if (!user) {
      navigate("/login?next=%2Fproducts");
      return;
    }

    const isSaved = savedNames.includes(product.name);
    setWishlistBusy(product.name);
    try {
      if (isSaved) {
        await api(`/api/wishlist?name=${encodeURIComponent(product.name)}`, { method: "DELETE" });
        setSavedNames((current) => current.filter((name) => name !== product.name));
      } else {
        await api("/api/wishlist", { method: "POST", body: { product } });
        setSavedNames((current) => [...current, product.name]);
      }
    } catch (error) {
      setCompareNotice(error.message || "Unable to update wishlist. Please try again.");
    } finally {
      setWishlistBusy("");
    }
  };

  const clearFilters = () => {
    setBrandFilter("");
    setStoreFilter("");
    setMinPrice("");
    setMaxPrice("");
    setMinRating("");
  };

  return (
    <>
      <Navbar />

      <main className="container products-page">
        <header className="products-header">
          <div>
            <span className="badge">
              <i className="dot-live" /> Live prices
            </span>
            <h1>Explore products</h1>
            <p>Top listings with prices compared across stores in India.</p>
          </div>

          <form className="input-icon products-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              className="input"
              type="text"
              placeholder="Search any product and press Enter"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              maxLength={200}
            />
          </form>
        </header>

        <CategoryTabs
          categories={DEPARTMENTS}
          active={department.name}
          onSelect={changeDepartment}
        />

        <div className="subcategory-chips" role="tablist" aria-label={`${department.name} categories`}>
          {department.categories.map(({ name, icon: Icon }) => {
            const active = !query && name === category;

            return (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? "subcategory-chip active" : "subcategory-chip"}
                onClick={() => changeCategory(name)}
              >
                <Icon size={15} />
                {name}
              </button>
            );
          })}
        </div>

        <div className="products-meta">
          {query ? (
            <div className="search-chip">
              Results for <strong>"{query}"</strong>
              <button
                type="button"
                onClick={() => changeCategory(category)}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="products-count-block">
              <p className="products-count">
                {loading
                  ? "Fetching live listings and comparing prices across stores..."
                  : `Showing ${filteredProducts.length} of ${sortedProducts.length} listings in ${category}`}
              </p>
              {!loading && result.checkedAt && (
                <span className="prices-checked-at">
                  Prices last checked {new Date(result.checkedAt).toLocaleString("en-IN", {
                    day: "2-digit", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              )}
            </div>
          )}

          <div className="products-controls">
            <button
              type="button"
              className={filtersOpen ? "filter-toggle active" : "filter-toggle"}
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal size={16} />
              Filters
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
            <label className="sort-select">
              <ArrowUpDown size={16} />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort products"
              >
                <option value="">Recommended</option>
                <option value="low">Price: Low to High</option>
                <option value="high">Price: High to Low</option>
                <option value="rating">Highest Rating</option>
              </select>
            </label>
          </div>
        </div>

        {filtersOpen && (
          <section className="product-filters" aria-label="Filter products">
            <div className="filter-heading">
              <div>
                <strong>Refine your results</strong>
                <span>Use the filters available in these listings.</span>
              </div>
              <button type="button" onClick={clearFilters} disabled={!activeFilterCount}>Clear all</button>
            </div>
            <div className="filter-fields">
              <label>
                Brand
                <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
                  <option value="">All brands</option>
                  {brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
                </select>
              </label>
              <label>
                Store
                <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
                  <option value="">All stores</option>
                  {stores.map((store) => <option key={store} value={store}>{store}</option>)}
                </select>
              </label>
              <label>
                Minimum price (₹)
                <input type="number" min="0" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
              </label>
              <label>
                Maximum price (₹)
                <input type="number" min="0" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="No limit" />
              </label>
              <label>
                Minimum rating
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                  <option value="">Any rating</option>
                  <option value="3">3+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="4.5">4.5+ stars</option>
                </select>
              </label>
            </div>
            <p className="filter-results-count">{filteredProducts.length} matching listings</p>
          </section>
        )}

        {compareNotice && <p className="compare-notice" role="status">{compareNotice}</p>}

        {loading ? (
          <>
            <div className="products-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          </>
        ) : sortedProducts.length > 0 ? (
          <>
            <div className="products-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id || product.name}
                  product={product}
                  selectedForCompare={selectedForCompare.some((item) => (item.id || item.name) === (product.id || product.name))}
                  onCompare={() => toggleCompare(product)}
                  isWishlisted={savedNames.includes(product.name)}
                  wishlistBusy={wishlistBusy === product.name}
                  onWishlist={() => toggleWishlist(product)}
                />
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="empty-state">
                <PackageSearch size={36} />
                <h2>No products match these filters</h2>
                <p>Try changing your price range, brand, store or rating.</p>
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>Clear filters</button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <PackageSearch size={40} />
            <h2>No products found</h2>
            <p>{error || "Try another search or category."}</p>
          </div>
        )}

        {selectedForCompare.length > 0 && (
          <aside className="compare-dock" aria-label="Selected products for comparison">
            <div className="compare-dock-copy">
              <strong>{selectedForCompare.length} of 4 products selected</strong>
              <span>{selectedForCompare.map((item) => item.name).join(" · ")}</span>
            </div>
            <button
              type="button"
              className="btn btn-primary compare-open"
              disabled={selectedForCompare.length < 2}
              onClick={() => setCompareOpen((open) => !open)}
            >
              Compare {selectedForCompare.length} products
            </button>
            <button type="button" className="icon-btn compare-clear" onClick={() => { setSelectedForCompare([]); setCompareOpen(false); }} aria-label="Clear comparison">
              <X size={17} />
            </button>
          </aside>
        )}

        {compareOpen && selectedForCompare.length >= 2 && (
          <section className="compare-panel" aria-label="Product comparison">
            <div className="compare-panel-heading">
              <div>
                <span>SMARTBUY COMPARISON</span>
                <h2>Compare your shortlist</h2>
                <p>Compare the listing details currently available. Open product details for full technical specifications.</p>
              </div>
              <button type="button" className="icon-btn" onClick={() => setCompareOpen(false)} aria-label="Close comparison"><X size={18} /></button>
            </div>
            <div className="compare-table-scroll">
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Details</th>
                    {selectedForCompare.map((item) => (
                      <th key={item.id || item.name}>
                        <span>{item.name}</span>
                        <button type="button" onClick={() => toggleCompare(item)} aria-label={`Remove ${item.name} from comparison`}><X size={14} /></button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Price", (item) => `₹${Number(item.price || 0).toLocaleString("en-IN")}`],
                    ["Best listed store", (item) => item.store || "Not available"],
                    ["Rating", (item) => item.rating ? `${item.rating} / 5` : "Not listed"],
                    ["Reviews", (item) => item.reviews ? Number(item.reviews).toLocaleString("en-IN") : "Not listed"],
                    ["Store offers", (item) => String(item.offers?.length || 0)],
                    ["Category", (item) => item.category || category]
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      {selectedForCompare.map((item) => <td key={item.id || item.name}>{value(item)}</td>)}
                    </tr>
                  ))}
                  <tr>
                    <th scope="row">Technical specifications</th>
                    {selectedForCompare.map((item) => (
                      <td key={item.id || item.name}>
                        <a href={`/product?name=${encodeURIComponent(item.name)}`}>View details</a>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="compare-footnote">Only information returned by the product listings is compared here. Technical specifications are not guessed; open each product to review its detailed specs.</p>
          </section>
        )}
      </main>
    </>
  );
}

export default Products;
