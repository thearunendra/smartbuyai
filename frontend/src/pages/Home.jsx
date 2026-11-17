import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Check,
  Mic,
  MicOff,
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

const shoppingIntents = [
  {
    icon: Laptop,
    eyebrow: "WORK & STUDY",
    title: "Build a productive setup",
    text: "Find a laptop, monitor and everyday essentials that work well together.",
    query: "Build a work and study setup under ₹80,000"
  },
  {
    icon: Gamepad2,
    eyebrow: "GAMING",
    title: "Upgrade your gaming setup",
    text: "Explore gaming laptops, accessories and gear around your budget.",
    query: "Help me build a gaming setup under ₹1,00,000"
  },
  {
    icon: Smartphone,
    eyebrow: "EVERYDAY TECH",
    title: "Find your everyday essentials",
    text: "Compare phones, earbuds and useful tech for daily life.",
    query: "Find a good smartphone and wireless earbuds under ₹30,000"
  },
  {
    icon: House,
    eyebrow: "HOME",
    title: "Make your home work better",
    text: "Shop appliances and home essentials in one simple request.",
    query: "Find a refrigerator, washing machine and microwave under ₹70,000"
  }
];

const decisionSteps = [
  {
    number: "01",
    label: "Understand",
    summary: "Your needs, budget & priorities",
    detailTitle: "Start with what matters to you.",
    detail: "SmartBuy reads your brief and identifies the budget, product type, use case and must-have features behind your request.",
    icon: Sparkles
  },
  {
    number: "02",
    label: "Discover",
    summary: "Relevant products from stores",
    detailTitle: "Find options that fit your brief.",
    detail: "Your requirements guide product discovery, so the shortlist stays focused on relevant options instead of an endless catalogue.",
    icon: Search
  },
  {
    number: "03",
    label: "Compare",
    summary: "Price, features & seller details",
    detailTitle: "Look beyond the headline price.",
    detail: "Compare the details that influence a good purchase: specifications, available offers and seller information.",
    icon: Store
  },
  {
    number: "04",
    label: "Recommend",
    summary: "A shortlist with clear reasons",
    detailTitle: "Choose with more confidence.",
    detail: "SmartBuy brings the comparison together and explains why an option may suit your priorities. The final decision stays with you.",
    icon: BadgeCheck
  }
];

function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [listening, setListening] = useState(false);
  const [activeDecisionStep, setActiveDecisionStep] = useState(0);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.stop?.(), []);

  const ask = (text) => {
    const value = text.trim();

    if (value) {
      navigate(`/chatbot?q=${encodeURIComponent(value)}`);
    }
  };

  const startVoiceSearch = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceMessage("Voice search is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = window.navigator.language || "en-IN";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setListening(true);
        setVoiceMessage("Listening… say what you want to find.");
      };

      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript?.trim();
        if (transcript) {
          setQuery(transcript);
          setVoiceMessage("Voice input added. Press Ask AI to search.");
        }
      };

      recognition.onerror = (event) => {
        setVoiceMessage(
          event.error === "not-allowed"
            ? "Microphone permission was blocked. Allow microphone access and try again."
            : "We could not capture your voice. Please try again."
        );
      };

      recognition.onend = () => setListening(false);
      recognition.start();
    } catch {
      setListening(false);
      setVoiceMessage("Voice search could not start. Please try again.");
    }
  };

  const stopVoiceSearch = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
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
                The right product.
                <br />
                <span className="gradient-text">A smarter buy.</span>
              </h1>

              <p>
                Tell us what matters — your budget, use case and must-have features.
                SmartBuy AI helps you explore relevant listings and compare
                available store offers, even across multiple product types.
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
                  placeholder="e.g. Best laptop under ₹60,000 for coding"
                  aria-label="What are you shopping for?"
                  maxLength={200}
                />

                <button
                  className={`hero-voice-btn${listening ? " is-listening" : ""}`}
                  type="button"
                  onClick={listening ? stopVoiceSearch : startVoiceSearch}
                  aria-label={listening ? "Stop voice search" : "Search by voice"}
                  title={listening ? "Stop voice search" : "Search by voice"}
                >
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                <button type="submit" className="btn btn-primary">
                  Ask AI <ArrowRight size={16} />
                </button>
              </form>

              {voiceMessage && (
                <p className="hero-voice-feedback" role="status" aria-live="polite">
                  {voiceMessage}
                </p>
              )}

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

            <div className="hero-preview decision-hub">
              <div className="decision-hub-head">
                <div className="decision-hub-brand">
                  <span className="decision-hub-mark"><Bot size={19} /></span>
                  <div>
                    <span>INSIDE SMARTBUY AI</span>
                    <strong>The journey to a smarter buy</strong>
                  </div>
                </div>
                <span className="decision-hub-count">One clear journey</span>
              </div>

              <div className="decision-hub-intro">
                <span>NOT JUST A PRODUCT SEARCH</span>
                <h2>Your shopping brief. A <em>better decision.</em></h2>
                <p>A simple, transparent process to help you choose with confidence.</p>
              </div>

              <div className="decision-steps" aria-label="How SmartBuy AI works">
                {decisionSteps.map(({ number, label, summary, icon: Icon }, index) => (
                  <button
                    key={number}
                    type="button"
                    className={`decision-step${activeDecisionStep === index ? " is-active" : ""}`}
                    onClick={() => setActiveDecisionStep(index)}
                    aria-pressed={activeDecisionStep === index}
                  >
                    <span className="decision-step-icon"><Icon size={19} /></span>
                    <span className="decision-step-copy">
                      <small>{number}</small>
                      <strong>{label}</strong>
                      <span>{summary}</span>
                    </span>
                    <ArrowUpRight size={15} className="decision-step-arrow" />
                  </button>
                ))}
              </div>

              <div className="decision-detail" key={activeDecisionStep}>
                <span className="decision-detail-number">{decisionSteps[activeDecisionStep].number}</span>
                <div>
                  <span className="decision-detail-kicker">WHAT SMARTBUY DOES</span>
                  <strong>{decisionSteps[activeDecisionStep].detailTitle}</strong>
                  <p>{decisionSteps[activeDecisionStep].detail}</p>
                </div>
              </div>

              <div className="decision-hub-footer">
                <span><i className="dot-live" /> Clear comparisons. Your decision.</span>
                <span>YOU STAY IN CONTROL</span>
              </div>
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

        <section className="container home-section intent-section">
          <div className="section-heading section-heading-row">
            <div>
              <span>START WITH AN IDEA</span>
              <h2>What are you shopping for?</h2>
              <p>Choose a goal to give SmartBuy AI a useful starting point.</p>
            </div>
            <Link to="/chatbot" className="text-link">
              Ask something else <ArrowRight size={16} />
            </Link>
          </div>

          <div className="intent-grid">
            {shoppingIntents.map(({ icon: Icon, eyebrow, title, text, query: intentQuery }) => (
              <Link
                key={title}
                to={`/chatbot?q=${encodeURIComponent(intentQuery)}`}
                className="intent-card"
              >
                <span className="intent-card-top">
                  <span className="intent-icon"><Icon size={21} /></span>
                  <ArrowUpRight size={17} className="intent-arrow" />
                </span>
                <span className="intent-eyebrow">{eyebrow}</span>
                <strong>{title}</strong>
                <p>{text}</p>
                <span className="intent-action">Explore idea <ArrowRight size={14} /></span>
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
