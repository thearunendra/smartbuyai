import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, Mail, ShieldCheck, UserRound } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../auth";

function AdminLogin() {
  const navigate = useNavigate();
  const { user, signIn, signOut } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user?.role === "admin" && !submitting) {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email || !password) {
      setMessage("Please fill all fields.");
      return;
    }

    setSubmitting(true);

    try {
      const signedIn = await signIn(email.trim(), password);

      if (signedIn.role !== "admin") {
        signOut();
        setMessage("This account doesn't have admin access.");
        setSubmitting(false);
        return;
      }

      navigate("/admin", { replace: true });
    } catch (error) {
      setMessage(error.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-switcher" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected="false"
          onClick={() => navigate("/login")}
        >
          <UserRound size={16} /> Customer
        </button>

        <button type="button" className="active" role="tab" aria-selected="true">
          <ShieldCheck size={16} /> Admin
        </button>
      </div>

      <span className="auth-icon">
        <ShieldCheck size={24} />
      </span>

      <h1>Admin sign in</h1>

      <p className="auth-subtitle">
        Access search analytics and product trends.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="admin-email">Admin email</label>
          <div className="input-icon">
            <Mail size={18} />
            <input
              id="admin-email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="admin-password">Password</label>
          <div className="input-icon">
            <Lock size={18} />
            <input
              id="admin-password"
              className="input"
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>

        {message && <div className="alert">{message}</div>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
        >
          {submitting ? "Please wait..." : "Sign in as admin"}
        </button>
      </form>

      <button
        type="button"
        className="auth-back"
        onClick={() => navigate("/login")}
      >
        <ArrowLeft size={16} /> Back to customer sign in
      </button>
    </AuthLayout>
  );
}

export default AdminLogin;
