import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  History,
  LayoutGrid,
  LogOut,
  Mail,
  MessageSquare
} from "lucide-react";
import Navbar from "../components/Navbar";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatChatDate } from "../utils/dates";
import "./Profile.css";

function Profile() {
  const navigate = useNavigate();
  const { user, checking, signOut } = useAuth();
  const [chats, setChats] = useState(null);

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

    return () => {
      ignore = true;
    };
  }, [user]);

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
