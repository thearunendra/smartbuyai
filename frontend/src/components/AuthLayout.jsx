import { Link } from "react-router-dom";
import { BadgeCheck, Sparkles, Store, Zap } from "lucide-react";
import "./AuthLayout.css";

const points = [
  { icon: Zap, text: "AI picks the right product for your budget" },
  { icon: Store, text: "Live prices compared across major stores" },
  { icon: BadgeCheck, text: "A clear reason behind every recommendation" }
];

function AuthLayout({ children }) {
  return (
    <main className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-glow" />

        <Link to="/" className="auth-logo">
          <span className="logo-mark">
            <Sparkles size={18} />
          </span>
          SmartBuy AI
        </Link>

        <div className="auth-brand-copy">
          <h2>Shop smarter with your AI assistant.</h2>

          <ul>
            {points.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span>
                  <Icon size={16} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="auth-brand-foot">
          © {new Date().getFullYear()} SmartBuy AI
        </p>
      </aside>

      <section className="auth-panel">
        <div className="auth-card">{children}</div>
      </section>
    </main>
  );
}

export default AuthLayout;
