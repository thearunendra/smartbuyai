import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Search,
  Smartphone,
  Sparkles,
  Store,
  Zap
} from "lucide-react";
import Navbar from "../components/Navbar";
import { DEPARTMENTS } from "../data/categories";
import "./Home.css";

const suggestions = [
  "Phone under ₹20,000 with good camera",
  "Gaming laptop under ₹80,000",
  "ANC headphones under ₹5,000"
];

const features = [
  {
    icon: Bot,
    title: "Tell us what you need",
    text: "Describe the product, budget and must-haves in plain words."
  },
  {
    icon: Zap,
    title: "AI picks the best",
    text: "SmartBuy AI scans live listings and explains why each pick fits."
  },
  {
    icon: Store,
    title: "Buy at the lowest price",
    text: "Prices are compared across Amazon, Flipkart, Croma and more."
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

  return (
    <>
      <Navbar />

      <main className="home">
        <section className="hero">
          <div className="hero-bg" aria-hidden="true">
            <div className="hero-mesh" />
            <div className="hero-dots" />
            <div className="hero-beam" />
          </div>

          <div className="container hero-grid">
            <div className="hero-content">
              <span className="badge">
                <Sparkles size={14} /> AI-powered shopping assistant
              </span>

              <h1>
                Find the <span className="gradient-text">best product</span>
                <br />
                at the lowest price
              </h1>

              <p>
                Tell SmartBuy AI what you need and your budget. It picks the
                right products from live listings and compares prices across
                stores in India.
              </p>

              <form
                className="hero-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(query);
                }}
              >
                <Search size={20} />

                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="What are you shopping for?"
                  aria-label="Ask SmartBuy AI"
                />

                <button type="submit" className="btn btn-primary">
                  Ask AI <ArrowRight size={16} />
                </button>
              </form>

              <div className="hero-chips">
                {suggestions.map((text) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => ask(text)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>

            <div className="hero-preview" aria-hidden="true">
              <div className="preview-header">
                <span className="preview-avatar">
                  <Bot size={18} />
                </span>

                <div>
                  <strong>SmartBuy AI</strong>
                  <span>
                    <i className="dot-live" /> Online
                  </span>
                </div>
              </div>

              <div className="preview-bubble preview-user">
                I need a phone under ₹20,000
              </div>

              <div className="preview-bubble preview-ai">
                Here are the best picks with the lowest prices I found.
              </div>

              <div className="preview-product">
                <div className="preview-thumb">
                  <Smartphone size={26} />
                </div>

                <div className="preview-info">
                  <strong>moto g85 5G · 12+256 GB</strong>
                  <span>₹17,840 at Amazon</span>
                </div>

                <span className="preview-tag">Lowest</span>
              </div>

              <div className="preview-stores">
                <span>Amazon ₹17,840</span>
                <span>Flipkart ₹17,999</span>
                <span>+3 stores</span>
              </div>
            </div>
          </div>
        </section>

        <section className="container trust-strip">
          <div>
            <BadgeCheck size={20} />
            <span>Live prices, not a stored catalog</span>
          </div>

          <div>
            <Store size={20} />
            <span>Compared across major Indian stores</span>
          </div>

          <div>
            <Zap size={20} />
            <span>AI explains every recommendation</span>
          </div>
        </section>

        <section className="container home-section">
          <div className="section-heading">
            <span>Explore</span>
            <h2>Shop by category</h2>
          </div>

          <div className="category-grid">
            {DEPARTMENTS.map(({ name, icon: Icon, categories }) => (
              <Link
                key={name}
                to={`/products?department=${encodeURIComponent(name)}`}
                className="category-card"
              >
                <span className="category-icon">
                  <Icon size={26} />
                </span>

                <div className="category-text">
                  <h3>{name}</h3>
                  <p>{categories.length} categories</p>
                </div>

                <ArrowRight size={18} className="category-arrow" />
              </Link>
            ))}
          </div>
        </section>

        <section className="container home-section">
          <div className="section-heading">
            <span>How it works</span>
            <h2>From question to best deal in seconds</h2>
          </div>

          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="feature-card">
                <span className="feature-step">0{index + 1}</span>

                <span className="feature-icon">
                  <Icon size={22} />
                </span>

                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container home-section">
          <div className="cta-card">
            <div>
              <h2>Ready to find your next gadget?</h2>
              <p>Ask in your own words. SmartBuy AI does the comparing.</p>
            </div>

            <Link to="/chatbot" className="btn cta-btn">
              Start chatting <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <footer className="footer">
          <div className="container footer-inner">
            <span>© {new Date().getFullYear()} SmartBuy AI</span>
            <span>Prices are fetched live and may change on the store.</span>
          </div>
        </footer>
      </main>
    </>
  );
}

export default Home;
