import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../auth";
import {
  Home,
  LayoutGrid,
  Menu,
  MessageSquare,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  X
} from "lucide-react";

function getInitialTheme() {
  const saved = document.documentElement.dataset.theme;

  if (saved === "dark" || saved === "light") {
    return saved;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function Navbar() {
  const [theme, setTheme] = useState(getInitialTheme);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, checking } = useAuth();

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = next;

    try {
      localStorage.setItem("smartbuyTheme", next);
    } catch {
      // Theme still applies for this visit.
    }

    setTheme(next);
  };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo">
          <span className="logo-mark">
            <Sparkles size={18} />
          </span>
          SmartBuy <span className="logo-accent">AI</span>
        </Link>

        <div className={menuOpen ? "nav-links open" : "nav-links"}>
          <NavLink to="/" end onClick={() => setMenuOpen(false)}>
            <Home size={16} /> Home
          </NavLink>

          <NavLink to="/products" onClick={() => setMenuOpen(false)}>
            <LayoutGrid size={16} /> Products
          </NavLink>

          <NavLink to="/chatbot" onClick={() => setMenuOpen(false)}>
            <MessageSquare size={16} /> AI Assistant
          </NavLink>

          {user?.role === "admin" && (
            <NavLink to="/admin" onClick={() => setMenuOpen(false)}>
              <ShieldCheck size={16} /> Admin
            </NavLink>
          )}
        </div>

        <div className="nav-actions">
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {user ? (
            <Link to="/profile" className="nav-user">
              <span className="nav-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : "U"}
              </span>
              <span className="nav-user-name">
                {user.name?.split(" ")[0]}
              </span>
            </Link>
          ) : checking ? (
            <span className="nav-avatar nav-avatar-loading" aria-hidden="true" />
          ) : (
            <Link to="/login" className="btn btn-primary">
              Sign in
            </Link>
          )}

          <button
            type="button"
            className="icon-btn nav-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
