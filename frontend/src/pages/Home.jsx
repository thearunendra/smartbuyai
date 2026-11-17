import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Check,
  Search,
  Sparkles,
  Store,
  TrendingDown,
  Zap
} from "lucide-react";
import Navbar from "../components/Navbar";
import { CATEGORIES, DEPARTMENTS } from "../data/categories";
import "./Home.css";

const multiSearchExample =
  "show me chair, mobile, drone and fridge under 50000";

const suggestions = [
  "Phone under ₹20,000 with good camera",
  "Gaming laptop under ₹80,000",
  "ANC headphones under ₹5,000"
];

const popularCategoryNames = [
  "Smartphones",
  "Laptops",
  "Refrigerators",
  "Office Chairs",
  "Drones",
  "Headphones",
  "Mixer Grinders",
  "Air Conditioners"
];

const popularCategories = popularCategoryNames
  .map((name) => CATEGORIES.find((category) => category.name === name))
  .filter(Boolean);

const features = [
  {
    icon: Bot,
    eyebrow: "01 · Tell us",
    title: "Describe it your way",
    text: "Mention your budget, must-have features or the exact model. No complicated filters.",
    query: "I need a phone under ₹20,000 with a good camera"
  },
  {
    icon: Sparkles,
    eyebrow: "02 · Compare",
    title: "Shop multiple things at once",
    text: "Ask for up to 10 product types in one request and get category-wise recommendations.",
    query: multiSearchExample
  },
  {
    icon: TrendingDown,
    eyebrow: "03 · Save",
    title: "Find the better deal",
    text: "Compare available store offers and see the lowest listed price before you buy.",
    query: "Find the lowest price for Samsung Galaxy S series phone"
  }
];

function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const ask = (text) => {
    const value = text.trim();

    if (value) {
      navigate(`/chatbot?q=${encodeURIComponent(value)}`);
    }
  };

  const totalCategories = CATEGORIES.length;

  return (
    <>
      <Navbar />

      <main className="home">
        <section className="hero">
          <div className="hero-bg" aria-hidden="true">
            <div className="hero-mesh" />
            <div className="hero-dots" />
            <div className="hero-orb hero-orb-one" />
            <div className="hero-orb hero-orb-two" />
            <div className="hero-beam" />
          </div>

          <div className="container hero-grid">
            <div className="hero-content">
              <span className="badge hero-badge">
                <Sparkles size={14} /> Your AI-powered shopping copilot
              </span>

              <h1>
                Find the <span className="gradient-text">best product</span>
                <br />
                without the endless tabs.
              </h1>

              <p>
                Tell SmartBuy AI what you want. Compare up to 10 product types
                in one request, discover live listings and find better prices
                across stores in India.
              </p>

              <form
                className="hero-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  ask(query);
                }}
              >
                <Search size={20} />

                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Try “chair, mobile, drone and fridge under ₹50,000”"
                  aria-label="What are you shopping for?"
                  maxLength={200}
                />

                <button type="submit" className="btn btn-primary">
                  Ask AI <ArrowRight size={16} />
                </button>
              </form>

              <div className="hero-search-hint">
                <span><Check size={13} /> Plain language works</span>
                <span><Check size={13} /> Your budget, your rules</span>
              </div>

              <div className="hero-chips" aria-label="Popular search ideas">
                {suggestions.map((text) => (
                  <button key={text} type="button" onClick={() => ask(text)}>
                    {text} <ArrowUpRight size={13} />
                  </button>
                ))}
              </div>

              <div className="hero-stats" aria-label="Shopping assistant capabilities">
                <div>
                  <strong>10</strong>
                  <span>product types per request</span>
                </div>
                <div>
                  <strong>{totalCategories}</strong>
                  <span>product categories</span>
                </div>
                <div>
                  <strong>1</strong>
                  <span>simple search box</span>
                </div>
              </div>
            </div>

            <div className="hero-preview">
              <div className="preview-topline">
                <div className="preview-brand">
                  <span className="preview-avatar"><Bot size={19} /></span>
                  <div>
                    <strong>SmartBuy AI</strong>
                    <span><i className="dot-live" /> Shopping copilot</span>
                  </div>
                </div>
                <span className="preview-live"><span className="dot-live" /> Ready</span>
              </div>

              <div className="preview-kicker">A smarter way to shop</div>
              <div className="preview-user">
                “Chair, mobile, drone and fridge under ₹50,000”
              </div>

              <div className="preview-plan">
                <div className="preview-plan-icon"><Sparkles size={17} /></div>
                <div>
                  <strong>One request. Separate searches.</strong>
                  <span>SmartBuy AI splits your brief into product types.</span>
                </div>
              </div>

              <div className="preview-results">
                {[
                  { label: "Office chair", price: "Compare options", tone: "violet" },
                  { label: "Smartphone", price: "Find lowest offer", tone: "blue" },
                  { label: "Camera drone", price: "Compare stores", tone: "cyan" },
                  { label: "Refrigerator", price: "Within your budget", tone: "green" }
                ].map((item) => (
                  <div className="preview-result" key={item.label}>
                    <span className={`preview-result-icon ${item.tone}`}>
                      <Check size={14} />
                    </span>
                    <strong>{item.label}</strong>
                    <span>{item.price}</span>
                    <BadgeCheck size={15} className="preview-result-check" />
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="preview-try"
                onClick={() => ask(multiSearchExample)}
              >
                Try this multi-product search <ArrowRight size={15} />
              </button>
              <p className="preview-disclaimer">
                Example workflow · Live prices are fetched when you search
              </p>
            </div>
          </div>
        </section>

        <section className="container trust-strip" aria-label="SmartBuy AI benefits">
          <Link to="/products" className="trust-item">
            <span className="trust-icon"><BadgeCheck size={19} /></span>
            <span><strong>Live shopping listings</strong><small>Fresh results when you search</small></span>
            <ArrowUpRight size={16} className="trust-arrow" />
          </Link>

          <Link to="/products" className="trust-item">
            <span className="trust-icon"><Store size={19} /></span>
            <span><strong>Store price comparison</strong><small>Compare offers side by side</small></span>
            <ArrowUpRight size={16} className="trust-arrow" />
          </Link>

          <Link to="/chatbot" className="trust-item">
            <span className="trust-icon"><Zap size={19} /></span>
            <span><strong>AI-powered recommendations</strong><small>Shortlists with useful reasons</small></span>
            <ArrowUpRight size={16} className="trust-arrow" />
          </Link>
        </section>

        <section className="container home-section popular-section">
          <div className="section-heading section-heading-row">
            <div>
              <span>Jump right in</span>
              <h2>What are you looking for?</h2>
              <p>Choose a popular product type and start comparing.</p>
            </div>
            <Link to="/products" className="text-link">
              Explore all products <ArrowRight size={16} />
            </Link>
          </div>

          <div className="popular-grid">
            {popularCategories.map(({ name, icon: Icon, department }) => (
              <Link
                key={name}
                to={`/products?category=${encodeURIComponent(name)}`}
                className="popular-card"
              >
                <span className="popular-icon"><Icon size={22} /></span>
                <span className="popular-copy">
                  <strong>{name}</strong>
                  <small>{department}</small>
                </span>
                <ArrowUpRight size={17} className="popular-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section className="container home-section">
          <div className="section-heading section-heading-row">
            <div>
              <span>Explore the catalogue</span>
              <h2>Shop by category</h2>
              <p>From everyday essentials to your next big upgrade.</p>
            </div>
            <span className="category-total">{DEPARTMENTS.length} departments · {totalCategories} product types</span>
          </div>

          <div className="category-grid">
            {DEPARTMENTS.map(({ name, icon: Icon, categories }, index) => (
              <Link
                key={name}
                to={`/products?department=${encodeURIComponent(name)}`}
                className={`category-card category-card-${index + 1}`}
              >
                <span className="category-icon"><Icon size={25} /></span>
                <div className="category-text">
                  <h3>{name}</h3>
                  <p>{categories.length} product types</p>
                </div>
                <span className="category-action" aria-hidden="true">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="container home-section">
          <div className="section-heading">
            <span>Why SmartBuy AI</span>
            <h2>Less searching. More confident shopping.</h2>
            <p>One simple flow from your shopping brief to a shortlist you can compare.</p>
          </div>

          <div className="feature-grid">
            {features.map(({ icon: Icon, eyebrow, title, text, query: featureQuery }, index) => (
              <Link
                key={title}
                to={`/chatbot?q=${encodeURIComponent(featureQuery)}`}
                className={`feature-card feature-card-${index + 1}`}
              >
                <span className="feature-step">{eyebrow}</span>
                <span className="feature-icon"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="feature-link">Try it <ArrowRight size={15} /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="container home-section">
          <div className="cta-card">
            <div className="cta-copy">
              <span><Sparkles size={14} /> Your next great find starts here</span>
              <h2>Ready to make a smarter buy?</h2>
              <p>Tell us what matters. We’ll help you compare the options.</p>
            </div>
            <div className="cta-actions">
              <Link to="/chatbot" className="btn cta-btn">
                Open AI assistant <ArrowRight size={16} />
              </Link>
              <Link to="/products" className="cta-secondary">
                Browse products
              </Link>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="container footer-inner">
            <Link to="/" className="footer-brand">
              <span className="logo-mark"><Sparkles size={16} /></span>
              SmartBuy <span>AI</span>
            </Link>
            <div className="footer-links">
              <Link to="/products">Products</Link>
              <Link to="/chatbot">AI Assistant</Link>
              <Link to="/login">Sign in</Link>
            </div>
            <span>© {new Date().getFullYear()} SmartBuy AI · Prices may change at the store.</span>
          </div>
        </footer>
      </main>
    </>
  );
}

export default Home;
