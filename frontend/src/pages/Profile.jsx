import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Heart,
  History,
  LayoutGrid,
  LogOut,
  Mail,
  MessageSquare,
  ShoppingBag,
  Trash2
} from "lucide-react";
import Navbar from "../components/Navbar";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatChatDate } from "../utils/dates";
import { formatPrice, productPath } from "../utils/product";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const { user, checking, signOut } = useAuth();
  const [chats, setChats] = useState(null);
  const [wishlist, setWishlist] = useState(null);

  useEffect(() => {
    if (!user) return;

    let ignore = false;

    api("/api/chats")
      .then((data) => {
        if (!ignore) setChats(data.chats);
      })
      .catch(() => {
        if (!ignore) setChats([]);
      });

    api("/api/wishlist")
      .then((data) => {
        if (!ignore) setWishlist(data.items);
      })
      .catch(() => {
        if (!ignore) setWishlist([]);
      });

    return () => {
      ignore = true;
    };
  }, [user]);

  const removeFromWishlist = async (name) => {
    try {
      await api(`/api/wishlist?name=${encodeURIComponent(name)}`, {
        method: "DELETE"
      });
    } catch (error) {
      console.error(error);
    }

    setWishlist((prev) => prev?.filter((item) => item.name !== name) ?? prev);
  };

  if (checking) {
    return <Navbar />;
  }

  if (!user) {
    return <Navigate to="/login?next=/profile" replace />;
  }

  const logout = () => {
    signOut();
    navigate("/login");
  };

  const memberSince = new Date(user.createdAt).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric"
  });

  return (
    <>
      <Navbar />

      <main className="container profile-page">
        <section className="profile-hero">
          <div className="profile-cover" />

          <div className="profile-identity">
            <span className="profile-avatar">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </span>

            <div className="profile-names">
              <h1>{user.name}</h1>
              <p>
                <Mail size={14} /> {user.email}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={logout}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </section>

        <section className="profile-grid">
          <div className="profile-tile">
            <span className="tile-icon">
              <MessageSquare size={18} />
            </span>
            <p>Saved chats</p>
            <strong>{chats ? chats.length : "—"}</strong>
          </div>

          <div className="profile-tile">
            <span className="tile-icon">
              <CalendarDays size={18} />
            </span>
            <p>Member since</p>
            <strong>{memberSince}</strong>
          </div>

          <div className="profile-tile">
            <span className="tile-icon">
              <History size={18} />
            </span>
            <p>Last chat</p>
            <strong>
              {chats?.[0] ? formatChatDate(chats[0].updatedAt) : "—"}
            </strong>
          </div>
        </section>

        <section className="profile-panel">
          <div className="profile-panel-header">
            <h2>Recent chats</h2>
            {chats?.length > 0 && (
              <Link to="/chatbot" className="profile-link">
                Open assistant <ArrowRight size={14} />
              </Link>
            )}
          </div>

          {chats === null ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : chats.length === 0 ? (
            <p className="profile-empty">
              No chats yet. Ask SmartBuy AI something and it will be saved
              here.
            </p>
          ) : (
            <ul className="recent-chats">
              {chats.slice(0, 5).map((chat) => (
                <li key={chat.id}>
                  <Link to={`/chatbot/${chat.id}`}>
                    <MessageSquare size={16} />
                    <span>{chat.title}</span>
                    <time>{formatChatDate(chat.updatedAt)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="profile-panel">
          <div className="profile-panel-header">
            <h2>Wishlist</h2>
          </div>

          {wishlist === null ? (
            <div className="skeleton" style={{ height: 120 }} />
          ) : wishlist.length === 0 ? (
            <p className="profile-empty">
              No saved products yet. Open a product and tap{" "}
              <Heart size={13} /> Add to Wishlist.
            </p>
          ) : (
            <ul className="wishlist">
              {wishlist.map(({ id, name, product }) => (
                <li key={id}>
                  <Link to={productPath(product)} state={{ product }}>
                    <span className="wishlist-media">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <ShoppingBag size={20} />
                      )}
                    </span>
                    <span className="wishlist-name">{name}</span>
                    <span className="wishlist-price">
                      {formatPrice(product.price)}
                      <small>at {product.store}</small>
                    </span>
                  </Link>

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeFromWishlist(name)}
                    aria-label={`Remove ${name} from wishlist`}
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="profile-actions">
          <Link to="/chatbot" className="action-card">
            <span className="tile-icon">
              <MessageSquare size={20} />
            </span>

            <div>
              <h3>Ask SmartBuy AI</h3>
              <p>Get picks for your budget with live prices.</p>
            </div>

            <ArrowRight size={18} />
          </Link>

          <Link to="/products" className="action-card">
            <span className="tile-icon">
              <LayoutGrid size={20} />
            </span>

            <div>
              <h3>Browse products</h3>
              <p>Explore categories and compare stores.</p>
            </div>

            <ArrowRight size={18} />
          </Link>
        </section>
      </main>
    </>
  );
}

export default Profile;
