import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, authLoading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Password and confirm password must match.");
      return;
    }
    try {
      await signup({ email, password, displayName });
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not create account.");
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-top">
          <span>Already have an account?</span>
          <Link className="ghost-btn" to="/login">
            Sign in
          </Link>
        </div>
        <h1 className="brand-title">HappyState</h1>
        <form className="form-stack" onSubmit={onSubmit}>
          <h2>Get Started</h2>
          <p>Create your account below</p>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" />
          {error ? <div className="error-text">{error}</div> : null}
          <button className="primary-btn" disabled={authLoading} type="submit">
            {authLoading ? "Creating..." : "Sign up"}
          </button>
        </form>
      </div>
    </div>
  );
}
