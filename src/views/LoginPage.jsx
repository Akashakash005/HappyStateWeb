import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not sign in.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <span>Don&apos;t have an account?</span>
          <Link className="ghost-btn" to="/signup">
            Get Started
          </Link>
        </div>
        <h1 className="brand-title">HappyState</h1>
        <form className="form-stack" onSubmit={onSubmit}>
          <h2>Welcome Back</h2>
          <p>Enter your details below</p>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          {error ? <div className="error-text">{error}</div> : null}
          <button className="primary-btn" disabled={authLoading} type="submit">
            {authLoading ? "Signing In..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
