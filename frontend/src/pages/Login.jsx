import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, ShieldCheck, User, UserRound } from "lucide-react";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../auth";

// Only allow redirects to pages inside this site.
function safeNext(value) {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/chatbot";
}

function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, register } = useAuth();
  const next = safeNext(searchParams.get("next"));

  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user && !submitting) {
    return <Navigate to={next} replace />;
  }

  const handleCustomerLogin = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!email || !password || (isRegister && !name)) {
      setMessage("Please fill all fields.");
      return;
    }

    if (isRegister && password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    try {
      if (isRegister) {
        await register(name.trim(), email.trim(), password);
      } else {
        await signIn(email.trim(), password);
      }

      navigate(next, { replace: true });
    } catch (error) {
      setMessage(error.message);
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-switcher" role="tablist">
        <button type="button" className="active" role="tab" aria-selected="true">
          <UserRound size={16} /> Customer
        </button>

        <button
          type="button"
          role="tab"
          aria-selected="false"
          onClick={() => navigate("/admin-login")}
        >
          <ShieldCheck size={16} /> Admin
        </button>
      </div>

      <h1>{isRegister ? "Create your account" : "Welcome back"}</h1>

      <p className="auth-subtitle">
        {next.startsWith("/chatbot")
          ? "Sign in to chat with SmartBuy AI. Your chats are saved so you can come back to them anytime."
          : isRegister
            ? "Save your chats and shop smarter with SmartBuy AI."
            : "Sign in to continue to SmartBuy AI."}
      </p>

      <form className="auth-form" onSubmit={handleCustomerLogin}>
        {isRegister && (
          <div className="field">
            <label htmlFor="name">Full name</label>
            <div className="input-icon">
              <User size={18} />
              <input
                id="name"
                className="input"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </div>
          </div>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <div className="input-icon">
            <Mail size={18} />
            <input
              id="email"
              className="input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="input-icon">
            <Lock size={18} />
            <input
              id="password"
              className="input"
              type="password"
              placeholder={isRegister ? "At least 8 characters" : "Enter your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </div>
        </div>

        {message && <div className="alert">{message}</div>}

        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
        >
          {submitting
            ? "Please wait..."
            : isRegister
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <p className="auth-footer">
        {isRegister ? "Already have an account?" : "Don't have an account?"}
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setIsRegister(!isRegister);
            setMessage("");
          }}
        >
          {isRegister ? "Sign in" : "Create one"}
        </button>
      </p>
    </AuthLayout>
  );
}

export default Login;
