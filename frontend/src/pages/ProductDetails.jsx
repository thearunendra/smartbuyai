import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  AppWindow,
  ArrowLeftRight,
  BatteryFull,
  Bot,
  Camera,
  ChevronRight,
  CircleCheck,
  Coins,
  Cpu,
  ExternalLink,
  HardDrive,
  Heart,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  MemoryStick,
  MonitorSmartphone,
  Ruler,
  SendHorizontal,
  Share2,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Signal,
  Sparkles,
  Star,
  Store,
  Tag,
  ThumbsUp,
  Volume2,
  Weight,
  Zap
} from "lucide-react";
import Navbar from "../components/Navbar";
import StoreOffers from "../components/StoreOffers";
import { api } from "../api";
import { useAuth } from "../auth";
import { findCategory } from "../data/categories";
import {
  formatPrice,
  getDiscount,
  offerPrices,
  productBadges,
  productPath,
  smartScore,
  splitAlternatives
} from "../utils/product";
import "./ProductDetails.css";

const HIGHLIGHT_ICONS = {
  chip: Cpu,
  display: MonitorSmartphone,
  camera: Camera,
  battery: BatteryFull,
  network: Signal,
  os: AppWindow,
  storage: HardDrive,
  memory: MemoryStick,
  audio: Volume2,
  size: Ruler,
  weight: Weight,
  power: Zap,
  material: Layers,
  warranty: ShieldCheck,
  other: Sparkles
};

const BADGE_ICONS = {
  top: Star,
  popular: ThumbsUp,
  value: Tag
};

const SECTIONS = [
  { id: "overview", label: "Overview", icon: Info },
  { id: "why-buy", label: "Why Buy", icon: Lightbulb },
  { id: "specifications", label: "Specifications", icon: ListChecks },
  { id: "similar", label: "Similar Products", icon: ArrowLeftRight },
  { id: "cheaper", label: "Cheaper Alternatives", icon: Coins }
];

function Rating({ product }) {
  if (!product.rating) {
    return null;
  }

  return (
    <span className="pd-rating">
      <Star size={16} fill="currentColor" />
      {product.rating}
      {product.reviews && (
        <span>({product.reviews.toLocaleString("en-IN")} ratings)</span>
      )}
    </span>
  );
}

function ScoreRing({ value }) {
  const radius = 52;
  const length = 2 * Math.PI * radius;

  return (
    <div className="pd-score-ring">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} className="ring-track" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="ring-value"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - value / 10)}
        />
      </svg>
      <div className="pd-score-number">
        <strong>{value.toFixed(1)}</strong>
        <span>/10</span>
      </div>
    </div>
  );
}

function ScoreCard({ score, loading }) {
  if (!score) {
    return loading ? (
      <div className="pd-card skeleton" style={{ height: 260 }} />
    ) : null;
  }

  return (
    <section className="pd-card pd-score">
      <h2 className="pd-card-title">
        SmartBuy Score
        <span
          className="pd-info"
          title="Price and ratings come from live store data. Features and brand value are rated by SmartBuy AI."
        >
          <Info size={14} />
        </span>
      </h2>

      <div className="pd-score-body">
        <ScoreRing value={score.overall} />

        <ul className="pd-score-rows">
          {score.rows.map((row) => (
            <li key={row.key}>
              <span>{row.label}</span>
              <span className="pd-bar">
                <i style={{ width: `${row.score * 10}%` }} />
              </span>
              <strong>{row.score.toFixed(1)}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="pd-verdict">
        <Lightbulb size={20} />
        <div>
          <strong>{score.title}</strong>
          <p>{score.text}</p>
        </div>
      </div>
    </section>
  );
}

function PriceSummary({ product }) {
  const prices = offerPrices(product);
  const stores = product.offers?.length || 0;
  const highest = prices.at(-1);

  return (
    <section className="pd-card pd-summary">
      <div className="pd-summary-row">
        <Store size={20} />
        <div>
          <strong>Best price at {product.store}</strong>
          <p>
            {stores > 1
              ? `Compared across ${stores} stores`
              : "Live price from Google Shopping"}
          </p>
        </div>
      </div>

      {highest > product.price && (
        <div className="pd-summary-row">
          <Coins size={20} />
          <div>
            <strong>Save up to {formatPrice(highest - product.price)}</strong>
            <p>Compared with the highest store price</p>
          </div>
        </div>
      )}

      <div className="pd-summary-row">
        <ShieldCheck size={20} />
        <div>
          <strong>Delivery, stock and warranty</strong>
          <p>Shown by the store. Check them on the store page before buying.</p>
        </div>
      </div>
    </section>
  );
}

// The listing's own image first, then photos from Google Images.
function galleryImages(product, info) {
  const images = product.image ? [{ url: product.image, thumb: null }] : [];

  for (const image of info?.images || []) {
    if (!images.some((item) => item.url === image.url)) {
      images.push(image);
    }
  }

  return images;
}

// Store sites sometimes block images shown on other sites: falls back to
// Google's thumbnail, then hides the image.
function GalleryImage({ image, alt, className, onFail }) {
  const [src, setSrc] = useState(image.url);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      onError={() => {
        if (image.thumb && src !== image.thumb) {
          setSrc(image.thumb);
        } else {
          onFail(image.url);
        }
      }}
    />
  );
}

function Gallery({ name, images, loading }) {
  const [selected, setSelected] = useState(0);
  const [failed, setFailed] = useState([]);

  const shown = images.filter((image) => !failed.includes(image.url));
  const current = shown[Math.min(selected, shown.length - 1)];

  const markFailed = (url) =>
    setFailed((prev) => (prev.includes(url) ? prev : [...prev, url]));

  return (
    <div className={shown.length > 1 || loading ? "pd-media" : "pd-media pd-media-single"}>
      {(shown.length > 1 || loading) && (
        <div className="pd-thumbs" role="list" aria-label="Product images">
          {shown.map((image, index) => (
            <button
              key={image.url}
              type="button"
              role="listitem"
              className={image === current ? "pd-thumb active" : "pd-thumb"}
              onClick={() => setSelected(index)}
              aria-label={`Image ${index + 1}`}
            >
              <GalleryImage
                image={{ url: image.thumb || image.url, thumb: image.url }}
                alt=""
                onFail={() => markFailed(image.url)}
              />
            </button>
          ))}

          {loading &&
            [0, 1, 2].map((index) => (
              <span key={index} className="pd-thumb skeleton" aria-hidden="true" />
            ))}
        </div>
      )}

      <div className="pd-image">
        {current ? (
          <GalleryImage
            key={current.url}
            image={current}
            alt={name}
            onFail={markFailed}
          />
        ) : (
          <ShoppingBag size={56} />
        )}
      </div>
    </div>
  );
}

function AlternativeCard({ product }) {
  return (
    <Link to={productPath(product)} state={{ product }} className="pd-alt">
      <span className="pd-alt-media">
        {product.image ? (
          <img
            src={product.image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <ShoppingBag size={28} />
        )}
      </span>

      <span className="pd-alt-name" title={product.name}>
        {/* Some listings append keywords after " | ". */}
        {product.name.split(" | ")[0]}
      </span>

      {product.rating && (
        <span className="pd-alt-rating">
          <Star size={12} fill="currentColor" />
          {product.rating}
          {product.reviews && (
            <span>({product.reviews.toLocaleString("en-IN")})</span>
          )}
        </span>
      )}

      <span className="pd-alt-price">{formatPrice(product.price)}</span>
      <span className="pd-alt-store">at {product.store}</span>
    </Link>
  );
}

function AlternativesPanel({ id, icon: Icon, title, items, loading, empty }) {
  return (
    <section id={id} className="pd-card pd-section">
      <h2 className="pd-section-title">
        <Icon size={20} /> {title}
      </h2>

      {loading ? (
        <div className="pd-alt-grid">
          {[0, 1].map((index) => (
            <div key={index} className="skeleton" style={{ height: 220 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="pd-muted">{empty}</p>
      ) : (
        <div className="pd-alt-grid">
          {items.map((item) => (
            <AlternativeCard key={item.id} product={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const name = searchParams.get("name") || "";
  const passed = location.state?.product;
  const passedProduct = passed?.name === name ? passed : null;

  // Products from the chat already have store offers; others are looked up.
  const [lookup, setLookup] = useState({ name: null, product: null, error: "" });
  const [details, setDetails] = useState({ name: null, data: null });
  // Names of the signed-in user's wishlist products.
  const [savedNames, setSavedNames] = useState([]);
  const [notice, setNotice] = useState("");
  const [question, setQuestion] = useState("");
  const [activeSection, setActiveSection] = useState("overview");
  const noticeTimer = useRef(null);
  const tabsRef = useRef(null);
  // True while a tab click scrolls the page, so the tab stays highlighted.
  const scrollingToTab = useRef(false);
  const scrollTimer = useRef(null);

  const needsLookup = Boolean(name) && !passedProduct?.offers;

  const product =
    (lookup.name === name && lookup.product) || passedProduct || null;
  const lookupError = lookup.name === name ? lookup.error : "";
  // Saved under the product's own name, which can differ from the link's.
  const saved = Boolean(product) && savedNames.includes(product.name);
  const info = details.name === name ? details.data : null;
  const detailsLoading = Boolean(name) && details.name !== name;
  // Details wait for the final price (after any lookup): it sets the
  // segment for the alternatives.
  const price = needsLookup
    ? lookup.name === name
      ? (lookup.product || passedProduct)?.price
      : undefined
    : passedProduct?.price;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [name]);

  useEffect(() => {
    if (!needsLookup) return;

    let ignore = false;

    api(`/api/product?name=${encodeURIComponent(name)}`)
      .then((data) => {
        if (!ignore) setLookup({ name, product: data.product, error: "" });
      })
      .catch((error) => {
        if (!ignore) setLookup({ name, product: null, error: error.message });
      });

    return () => {
      ignore = true;
    };
  }, [name, needsLookup]);

  useEffect(() => {
    if (!name || !price) return;

    let ignore = false;
    const params = new URLSearchParams({ name, price: String(price) });

    api(`/api/product/details?${params}`)
      .then((data) => {
        if (!ignore) setDetails({ name, data });
      })
      .catch(() => {
        if (!ignore) setDetails({ name, data: { available: false, alternatives: [] } });
      });

    return () => {
      ignore = true;
    };
  }, [name, price]);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    api("/api/wishlist")
      .then((data) => {
        if (!ignore) setSavedNames(data.items.map((item) => item.name));
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [user]);

  useEffect(
    () => () => {
      clearTimeout(noticeTimer.current);
      clearTimeout(scrollTimer.current);
    },
    []
  );

  // Highlights the tab of the section under the tab bar while scrolling.
  const hasProduct = Boolean(product);

  useEffect(() => {
    if (!hasProduct) return;

    const update = () => {
      if (scrollingToTab.current) {
        clearTimeout(scrollTimer.current);
        scrollTimer.current = setTimeout(() => {
          scrollingToTab.current = false;
        }, 150);
        return;
      }

      // Where the bottom of the tab bar is once it sticks under the navbar
      // (not where it is now: before it sticks it sits right above Why Buy).
      const tabs = tabsRef.current;
      const line = tabs
        ? parseFloat(getComputedStyle(tabs).top) + tabs.offsetHeight + 24
        : 0;
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;

      const sections = SECTIONS.map(({ id }) => ({
        id,
        top: document.getElementById(id)?.getBoundingClientRect().top
      })).filter((section) => section.top !== undefined);

      // The last section that has reached the line. At the bottom of the page
      // the last sections can't reach it, so any visible one counts.
      const reached = sections.filter((section) =>
        atBottom ? section.top < window.innerHeight : section.top <= line
      );
      const current = reached.at(-1) || sections[0];

      if (!current) return;

      setActiveSection((active) => {
        // Side-by-side sections (Similar and Cheaper) start at the same
        // height: keep the one already selected.
        const activeSection = reached.find((section) => section.id === active);

        return activeSection && Math.abs(activeSection.top - current.top) < 2
          ? active
          : current.id;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [hasProduct]);

  const showNotice = (text) => {
    setNotice(text);
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2500);
  };

  const toggleWishlist = async () => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?next=${next}`);
      return;
    }

    try {
      if (saved) {
        await api(`/api/wishlist?name=${encodeURIComponent(product.name)}`, {
          method: "DELETE"
        });
        setSavedNames((prev) => prev.filter((item) => item !== product.name));
        showNotice("Removed from your wishlist");
      } else {
        await api("/api/wishlist", { method: "POST", body: { product } });
        setSavedNames((prev) => [...prev, product.name]);
        showNotice("Added to your wishlist");
      }
    } catch (error) {
      showNotice(error.message);
    }
  };

  const share = async () => {
    const url = window.location.origin + productPath({ name });

    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
      } catch {
        // Share sheet closed.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showNotice("Link copied");
    } catch {
      showNotice("Unable to copy the link");
    }
  };

  const goTo = (id) => {
    setActiveSection(id);
    scrollingToTab.current = true;
    clearTimeout(scrollTimer.current);
    // Released when scrolling stops (or now, if the page doesn't move).
    scrollTimer.current = setTimeout(() => {
      scrollingToTab.current = false;
    }, 1000);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const ask = (event) => {
    event.preventDefault();

    const text = question.trim();

    if (text) {
      navigate(`/chatbot?q=${encodeURIComponent(text)}`);
    }
  };

  if (!name) {
    return (
      <>
        <Navbar />
        <main className="container pd-page">
          <div className="pd-card pd-empty">
            <h1>No product selected</h1>
            <p>Ask SmartBuy AI or browse products to open a product.</p>
            <Link to="/chatbot" className="btn btn-primary">
              Ask SmartBuy AI
            </Link>
          </div>
        </main>
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <main className="container pd-page">
          {lookupError ? (
            <div className="pd-card pd-empty">
              <h1>Product not available</h1>
              <p>{lookupError}</p>
              <Link to="/chatbot" className="btn btn-primary">
                Ask SmartBuy AI
              </Link>
            </div>
          ) : (
            <div className="pd-top" aria-label="Loading product">
              <div className="skeleton" style={{ height: 380 }} />
              <div className="skeleton" style={{ height: 380 }} />
              <div className="skeleton" style={{ height: 380 }} />
            </div>
          )}
        </main>
      </>
    );
  }

  const available = info?.available !== false;
  const score = smartScore(product, info);
  const discount = getDiscount(product, info);
  const badges = productBadges(product, score);
  const { similar, cheaper } = splitAlternatives(
    info?.alternatives || [],
    product.price
  );
  const category = findCategory(info?.category);
  const buyOffer =
    product.offers?.find((offer) => offer.link && offer.price !== null) ||
    product.offers?.find((offer) => offer.link);
  const title = info?.shortName || product.name;

  return (
    <>
      <Navbar />

      <main className="container pd-page">
        <nav className="pd-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <ChevronRight size={14} />
          {category ? (
            <Link to={`/products?category=${encodeURIComponent(category.name)}`}>
              {category.name}
            </Link>
          ) : (
            <Link to="/products">Products</Link>
          )}
          {info?.brand && (
            <>
              <ChevronRight size={14} />
              <span>{info.brand}</span>
            </>
          )}
          <ChevronRight size={14} />
          <span className="pd-breadcrumb-current">{title}</span>
        </nav>

        <div id="overview" className="pd-top">
          <section className="pd-gallery">
            <Gallery
              key={name}
              name={product.name}
              images={galleryImages(product, info)}
              loading={detailsLoading}
            />

            {badges.length > 0 && (
              <div className="pd-badges">
                {badges.map((badge) => {
                  const Icon = BADGE_ICONS[badge.key];

                  return (
                    <span key={badge.key} className={`pd-badge pd-badge-${badge.key}`}>
                      <Icon size={13} /> {badge.label}
                    </span>
                  );
                })}
              </div>
            )}
          </section>

          <section className="pd-info-col">
            {info?.brand && <p className="pd-brand">{info.brand}</p>}

            <h1 className="pd-title">{title}</h1>

            {info?.shortName && info.shortName !== product.name && (
              <p className="pd-fullname">{product.name}</p>
            )}

            {info?.variant?.length > 0 && (
              <p className="pd-variant">{info.variant.join(" • ")}</p>
            )}

            <div className="pd-meta">
              <Rating product={product} />
              {category && (
                <span className="pd-category">in {category.name}</span>
              )}
            </div>

            <div className="pd-price-row">
              <span className="pd-price">{formatPrice(product.price)}</span>
              {discount && (
                <>
                  <span className="pd-mrp">{formatPrice(discount.mrp)}</span>
                  <span className="pd-off">{discount.percent}% OFF</span>
                </>
              )}
            </div>

            {discount && (
              <p className="pd-save">You save {formatPrice(discount.saving)}</p>
            )}

            <p className="pd-lowest">
              <Store size={14} />
              Lowest price at {product.store}
              {product.offers?.length > 1 &&
                ` among ${product.offers.length} stores`}
            </p>

            <div className="pd-actions">
              {buyOffer ? (
                <a
                  href={buyOffer.link}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary pd-buy"
                >
                  <ShoppingCart size={18} /> Buy Now on {buyOffer.store}
                </a>
              ) : (
                <button type="button" className="btn btn-primary pd-buy" disabled>
                  <ShoppingCart size={18} /> No store link yet
                </button>
              )}
            </div>

            <div className="pd-actions-small">
              <button
                type="button"
                className={saved ? "btn btn-secondary pd-saved" : "btn btn-secondary"}
                onClick={toggleWishlist}
                aria-pressed={saved}
              >
                <Heart size={16} fill={saved ? "currentColor" : "none"} />
                {saved ? "In Wishlist" : "Add to Wishlist"}
              </button>

              <button type="button" className="btn btn-secondary" onClick={share}>
                <Share2 size={16} /> Share
              </button>
            </div>

            {notice && (
              <p className="pd-notice" role="status">
                {notice}
              </p>
            )}
          </section>

          <aside className="pd-side">
            <ScoreCard score={score} loading={detailsLoading} />
            <PriceSummary product={product} />
          </aside>
        </div>

        <nav ref={tabsRef} className="pd-tabs" aria-label="Product sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={activeSection === id ? "active" : ""}
              onClick={() => goTo(id)}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </nav>

        {!detailsLoading && !available && (
          <p className="alert pd-alert">
            Product details aren't available right now. Prices and stores
            below are still live.
          </p>
        )}

        <div id="why-buy" className="pd-overview">
          <section className="pd-card pd-section">
            <h2 className="pd-section-title">
              <Bot size={20} /> Why SmartBuy recommends this
            </h2>

            {detailsLoading ? (
              <>
                <div className="skeleton" style={{ height: 70 }} />
                <div className="skeleton" style={{ height: 140, marginTop: 16 }} />
              </>
            ) : (
              <>
                {(info?.summary || product.reason) && (
                  <p className="pd-summary-text">{info?.summary || product.reason}</p>
                )}

                {info?.pros?.length > 0 && (
                  <ul className="pd-pros">
                    {info.pros.map((pro) => (
                      <li key={pro}>
                        <CircleCheck size={18} /> {pro}
                      </li>
                    ))}
                  </ul>
                )}

                {!info?.summary && !product.reason && !info?.pros?.length && (
                  <p className="pd-muted">No AI summary for this product yet.</p>
                )}
              </>
            )}
          </section>

          <section className="pd-card pd-section">
            <h2 className="pd-section-title">
              <Store size={20} /> Where to Buy
            </h2>

            <StoreOffers offers={product.offers} />

            {!product.offers?.length && (
              <p className="pd-muted">
                Listed at {product.store} for {formatPrice(product.price)}.
              </p>
            )}
          </section>
        </div>

        {(detailsLoading || info?.highlights?.length > 0) && (
          <section className="pd-card pd-section">
            <h2 className="pd-section-title">
              <Sparkles size={20} /> Key Highlights
            </h2>

            {detailsLoading ? (
              <div className="skeleton" style={{ height: 110 }} />
            ) : (
              <ul className="pd-highlights">
                {info.highlights.map((item) => {
                  const Icon = HIGHLIGHT_ICONS[item.icon] || Sparkles;

                  return (
                    <li key={`${item.title}-${item.detail}`}>
                      <span className="pd-highlight-icon">
                        <Icon size={22} />
                      </span>
                      <strong>{item.title}</strong>
                      <span>{item.detail}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section id="specifications" className="pd-card pd-section">
          <h2 className="pd-section-title">
            <ListChecks size={20} /> Specifications
          </h2>

          {detailsLoading ? (
            <div className="skeleton" style={{ height: 200 }} />
          ) : info?.specs?.length > 0 ? (
            <>
              <div className="pd-specs">
                {info.specs.map((group) => (
                  <div key={group.group} className="pd-spec-group">
                    <h3>{group.group}</h3>
                    <dl>
                      {group.items.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="pd-note">
                Collected from web results by SmartBuy AI. Confirm on the
                store page before buying.
              </p>
            </>
          ) : (
            <p className="pd-muted">Specifications aren't available for this product yet.</p>
          )}
        </section>

        <div className="pd-alternatives">
          <AlternativesPanel
            id="similar"
            icon={ArrowLeftRight}
            title="Similar Products"
            items={similar}
            loading={detailsLoading}
            empty="No similar products found at this price."
          />

          <AlternativesPanel
            id="cheaper"
            icon={Coins}
            title="Cheaper Alternatives"
            items={cheaper}
            loading={detailsLoading}
            empty="No cheaper alternatives found."
          />
        </div>

        <section className="pd-ask">
          <span className="pd-ask-icon">
            <Sparkles size={24} />
          </span>

          <div className="pd-ask-text">
            <h2>Need help choosing? Ask SmartBuy AI</h2>
            <p>Get personalised picks based on your budget and preferences.</p>
          </div>

          <form className="pd-ask-form" onSubmit={ask}>
            <input
              className="input"
              type="text"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={`e.g. Is ${title} worth it, or something better under ${formatPrice(product.price)}?`}
              maxLength={200}
              aria-label="Ask SmartBuy AI"
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!question.trim()}
              aria-label="Ask"
            >
              <SendHorizontal size={18} />
            </button>
          </form>
        </section>

        <p className="pd-disclaimer">
          <ExternalLink size={12} /> Live prices from search results. Confirm
          price, delivery and warranty on the store before buying.
        </p>
      </main>
    </>
  );
}

export default ProductDetails;
