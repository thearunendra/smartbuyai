import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CreditCard,
  Flame,
  LogOut,
  MessageSquare,
  RefreshCw,
  Search,
  SearchX,
  ShieldAlert,
  TrendingUp,
  Users
} from "lucide-react";
import Navbar from "../components/Navbar";
// TEMPORARY (2026-10-03): test results for the project demo, see TestingPanel.
import TestingPanel from "../components/TestingPanel";
import { api } from "../api";
import { useAuth } from "../auth";
import "./Admin.css";

function formatTime(time) {
  if (!time) return "";

  return new Date(time).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// "2026-09-26" -> "Sat" (the date is already in India time).
function dayLabel(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "short"
  });
}

function Admin() {
  const navigate = useNavigate();
  const { user, checking, signOut } = useAuth();
  const isAdmin = user?.role === "admin";

  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    let ignore = false;

    api("/api/admin/stats")
      .then((data) => {
        if (!ignore) {
          setStats(data);
          setError("");
        }
      })
      .catch((error) => {
        if (!ignore) {
          setError(error.message || "Unable to load admin data.");
        }
      });

    return () => {
      ignore = true;
    };
  }, [isAdmin, reloadKey]);

  if (checking) {
    return <Navbar />;
  }

  if (!user) {
    return <Navigate to="/admin-login" replace />;
  }

  const logout = () => {
    signOut();
    navigate("/admin-login");
  };

  if (!isAdmin) {
    return (
      <>
        <Navbar />

        <main className="container admin-page">
          <div className="panel admin-denied">
            <ShieldAlert size={40} />
            <h1>Admin access required</h1>
            <p>
              You're signed in as {user.email}, which isn't an admin
              account.
            </p>

            <div className="admin-actions">
              <button type="button" className="btn btn-primary" onClick={logout}>
                Sign in as admin
              </button>

              <Link to="/" className="btn btn-secondary">
                Back to home
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  const categories = stats?.categories || [];
  const products = (stats?.products || []).slice(0, 6);
  const recent = stats?.recentSearches || [];
  const zeroResults = stats?.zeroResultSearches || [];
  const perDay = stats?.searchesPerDay || [];

  const maxCategory = Math.max(1, ...categories.map((item) => item.count));
  const maxProduct = Math.max(1, ...products.map((item) => item.count));
  const maxDay = Math.max(1, ...perDay.map((day) => day.count));

  const kpis = [
    { icon: Search, label: "Total searches", value: stats?.totalSearches ?? 0 },
    { icon: BarChart3, label: "Searches (7 days)", value: stats?.searchesLast7Days ?? 0 },
    { icon: Users, label: "Users", value: stats?.users ?? 0 },
    { icon: MessageSquare, label: "Saved chats", value: stats?.chats ?? 0 },
    { icon: Flame, label: "Most searched", value: stats?.mostSearched?.category || "—" },
    { icon: CreditCard, label: "Serper credits left", value: stats?.serperCredits ?? "N/A" }
  ];

  return (
    <>
      <Navbar />

      <main className="container admin-page">
        <header className="admin-header">
          <div>
            <span className="badge">
              <i className="dot-live" /> Live data
            </span>
            <h1>Admin dashboard</h1>
            <p>Search activity and product trends on SmartBuy AI.</p>
          </div>

          <div className="admin-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReloadKey((key) => key + 1)}
            >
              <RefreshCw size={16} /> Refresh
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={logout}
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </header>

        {error && <div className="alert">{error}</div>}

        <section className="kpi-grid">
          {kpis.map(({ icon: Icon, label, value }) => (
            <div key={label} className="kpi-card">
              <span className="kpi-icon">
                <Icon size={18} />
              </span>

              <p>{label}</p>

              {stats ? (
                <strong title={String(value)}>{value}</strong>
              ) : (
                <div className="skeleton" style={{ height: 28, width: "60%" }} />
              )}
            </div>
          ))}
        </section>

        <section className="admin-columns">
          <div className="panel">
            <div className="panel-header">
              <h2>
                <BarChart3 size={18} /> Searches in the last 7 days
              </h2>
            </div>

            {stats ? (
              <div className="day-chart" role="img" aria-label="Searches per day for the last 7 days">
                {perDay.map((day) => (
                  <div key={day.date} className="day-column" title={`${day.date}: ${day.count} searches`}>
                    <span className="day-count">{day.count}</span>

                    <div className="day-track">
                      <div
                        className="day-bar"
                        style={{ height: `${(day.count / maxDay) * 100}%` }}
                      />
                    </div>

                    <span className="day-label">{dayLabel(day.date)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="skeleton" style={{ height: 180 }} />
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>
                <Activity size={18} /> Searches by category
              </h2>
            </div>

            {categories.length > 0 ? (
              <div className="bar-list">
                {categories.slice(0, 8).map((item) => (
                  <div key={item.category} className="bar-row">
                    <div className="bar-label">
                      <span>{item.category}</span>
                      <strong>{item.count}</strong>
                    </div>

                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${(item.count / maxCategory) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="panel-empty">
                {stats ? "No searches yet." : "Loading..."}
              </p>
            )}
          </div>
        </section>

        <section className="admin-columns">
          <div className="panel">
            <div className="panel-header">
              <h2>
                <TrendingUp size={18} /> Most recommended products
              </h2>
            </div>

            {products.length > 0 ? (
              <ol className="rank-list">
                {products.map((item, index) => (
                  <li key={item.product}>
                    <span className="rank">{index + 1}</span>

                    <div className="rank-info">
                      <span title={item.product}>{item.product}</span>

                      <div className="bar-track bar-track-thin">
                        <div
                          className="bar-fill"
                          style={{ width: `${(item.count / maxProduct) * 100}%` }}
                        />
                      </div>
                    </div>

                    <strong>{item.count}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="panel-empty">
                {stats ? "No product data yet." : "Loading..."}
              </p>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>
                <SearchX size={18} /> Searches with no results
              </h2>
            </div>

            {zeroResults.length > 0 ? (
              <ul className="zero-list">
                {zeroResults.map((search, index) => (
                  <li key={`${search.time}-${index}`}>
                    <span title={search.query}>{search.query}</span>
                    <time>{formatTime(search.time)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="panel-empty">
                {stats
                  ? "Every recent search found products."
                  : "Loading..."}
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>
              <Search size={18} /> Recent searches
            </h2>
            <span className="panel-meta">Last {recent.length}</span>
          </div>

          {recent.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Query</th>
                    <th>Category</th>
                    <th>Results</th>
                    <th>Time</th>
                  </tr>
                </thead>

                <tbody>
                  {recent.map((search, index) => (
                    <tr key={`${search.time}-${index}`}>
                      <td className="cell-query">{search.query}</td>
                      <td>
                        <span className="tag">{search.category}</span>
                      </td>
                      <td>{search.results ?? 0}</td>
                      <td className="cell-muted">{formatTime(search.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="panel-empty">
              {stats ? "No recent searches." : "Loading..."}
            </p>
          )}
        </section>

        <TestingPanel />
      </main>
    </>
  );
}

export default Admin;
