import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowUpDown, PackageSearch, Search, X } from "lucide-react";
import Navbar from "../components/Navbar";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import CategoryTabs from "../components/CategoryTabs";
import { API_URL } from "../config";
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
            <p className="products-count">
              {loading
                ? "Fetching live listings and comparing prices across stores..."
                : `Showing ${sortedProducts.length} live listings in ${category}`}
            </p>
          )}

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
              {sortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <PackageSearch size={40} />
            <h2>No products found</h2>
            <p>{error || "Try another search or category."}</p>
          </div>
        )}
      </main>
    </>
  );
}

export default Products;
