import { Link } from "react-router-dom";
import {
  BadgeCheck,
  ArrowRight,
  Sparkles,
  Store,
  Zap
} from "lucide-react";
import "./AuthLayout.css";

const points = [
  { icon: Zap, title: "AI-guided discovery", text: "Find options that fit your budget and needs." },
  { icon: Store, title: "Store-by-store comparison", text: "Review offers from multiple retailers in one place." },
  { icon: BadgeCheck, title: "Clearer decisions", text: "Understand why a product may suit you." }
];

const journey = [
  { number: "01", label: "Describe your need" },
  { number: "02", label: "Compare store offers" },
  { number: "03", label: "Choose with clarity" }
];

function AuthLayout({ children }) {
  return (
    <main className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-glow" aria-hidden="true" />
        <div className="auth-brand-grid" aria-hidden="true" />

        <Link to="/" className="auth-logo" aria-label="SmartBuy AI home">
          <span className="auth-logo-emblem" aria-hidden="true">
            <ShoppingBag className="auth-logo-bag" size={31} strokeWidth={2.1} />
            <span className="auth-logo-spark">
              <Sparkles size={16} strokeWidth={2.4} />
            </span>
          </span>
          <span className="auth-logo-type">
            <span className="auth-logo-wordmark">SmartBuy<span>AI</span></span>
            <span className="auth-logo-tagline">INTELLIGENT SHOPPING, SIMPLIFIED</span>
          </span>
        </Link>

        <div className="auth-brand-content">
          <span className="auth-brand-kicker">
            <span className="auth-kicker-dot" />
            YOUR PERSONAL SHOPPING COPILOT
          </span>

          <h2>
            Shopping decisions,
            <span> made smarter.</span>
          </h2>

          <p className="auth-brand-description">
            Less searching. More clarity. Bring your product needs and budget
            together with AI-assisted discovery and store comparisons.
          </p>

          <ul className="auth-brand-points">
            {points.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="auth-point-icon">
                  <Icon size={18} />
                </span>
                <span className="auth-point-copy">
                  <strong>{title}</strong>
                  <small>{text}</small>
                </span>
                <ArrowRight className="auth-point-arrow" size={16} />
              </li>
            ))}
          </ul>

          <div className="auth-journey-card">
            <div className="auth-journey-heading">
              <span>THE SMARTBUY JOURNEY</span>
              <span className="auth-journey-live"><i /> Simple by design</span>
            </div>
            <div className="auth-journey-steps">
              {journey.map((step, index) => (
                <div className="auth-journey-step" key={step.number}>
                  <span className="auth-step-number">{step.number}</span>
                  <span>{step.label}</span>
                  {index < journey.length - 1 && (
                    <span className="auth-step-connector" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="auth-brand-footer">
          <span>© {new Date().getFullYear()} SmartBuy AI</span>
          <span>DISCOVER <i /> COMPARE <i /> DECIDE</span>
        </div>
      </aside>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-panel-top">
            <span className="auth-secure-label">
              <BadgeCheck size={15} /> Secure account access
            </span>
            <Link to="/" className="auth-home-link">Back to website <ArrowRight size={14} /></Link>
          </div>

          <div className="auth-card">{children}</div>

          <p className="auth-panel-note">
            Your shopping conversations stay organised in your account.
          </p>
        </div>
      </section>
    </main>
  );
}

export default AuthLayout;
