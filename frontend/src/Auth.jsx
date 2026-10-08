import React, { useState } from "react";
import axios from "axios";
import {
  HeartPulse,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
} from "lucide-react";

export default function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (isRegister && !name.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const base = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
      const response = await axios.post(`${base}/auth/${isRegister ? "register" : "login"}`, { name: name.trim(), email: email.trim(), password }, { timeout: 15000 });
      onLogin(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not connect to the account service. Please try again.");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">

      {/* ================= LEFT HERO ================= */}
      <section className="auth-hero">

        <div className="auth-brand">
          <div className="auth-brand-icon">
            <HeartPulse size={23} />
          </div>

          <div className="auth-brand-name">
            CareBridge <span>Patient Care AI</span>
          </div>
        </div>

        <div className="auth-hero-content">

          <div className="auth-eyebrow">
            <Sparkles size={14} />
            AI-POWERED HEALTHCARE
          </div>

          <h1>
            Understand your
            <br />
            care. <span>Take control.</span>
          </h1>

          <p className="auth-hero-description">
            CareBridge transforms complex hospital discharge
            instructions into a simple, patient-friendly care plan.
          </p>

          <div className="auth-benefits">

            <div className="auth-benefit">
              <CheckCircle2 size={19} />
              <span>Understand your medicines</span>
            </div>

            <div className="auth-benefit">
              <CheckCircle2 size={19} />
              <span>Know important warning signs</span>
            </div>

            <div className="auth-benefit">
              <CheckCircle2 size={19} />
              <span>Never miss your follow-up</span>
            </div>

          </div>

          <div className="auth-privacy">
            <ShieldCheck size={17} />
            <span>
              Your health information should always be handled with care.
            </span>
          </div>

        </div>
      </section>

      {/* ================= RIGHT AUTH ================= */}
      <section className="auth-form-side">

        <div className="auth-card">

          {/* Mobile brand */}
          <div className="auth-mobile-brand">
            <div>
              <HeartPulse size={20} />
            </div>

            <strong>CareBridge</strong>
          </div>

          <div className="auth-card-header">

            <h2>
              {isRegister
                ? "Create your account"
                : "Welcome back"}
            </h2>

            <p>
              {isRegister
                ? "Create your personal care workspace."
                : "Sign in to access your personal care workspace."}
            </p>

          </div>

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form
            className="auth-form"
            onSubmit={handleSubmit}
          >

            {/* NAME */}
            {isRegister && (
              <div className="auth-field">

                <label>Full name</label>

                <div className="auth-input">

                  <User size={17} />

                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                  />

                </div>

              </div>
            )}

            {/* EMAIL */}
            <div className="auth-field">

              <label>Email address</label>

              <div className="auth-input">

                <Mail size={17} />

                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                />

              </div>

            </div>

            {/* PASSWORD */}
            <div className="auth-field">

              <div className="auth-password-row">

                <label>Password</label>

                {!isRegister && (
                  <button
                    type="button"
                    className="forgot-password"
                    onClick={() =>
                      alert(
                        "Password recovery will be available in the full version."
                      )
                    }
                  >
                    Forgot password?
                  </button>
                )}

              </div>

              <div className="auth-input">

                <Lock size={17} />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>

              </div>

            </div>

            {/* SUBMIT */}
            <button
              type="submit"
              className="primary-button auth-submit"
            >

              {loading ? "Please wait…" : isRegister
                ? "Create account"
                : "Sign in"}

              {!loading && <ArrowRight size={17} />}

            </button>

          </form>

          {/* SWITCH */}
          <div className="auth-switch">

            {isRegister
              ? "Already have an account?"
              : "New to CareBridge?"}

            {" "}

            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
            >
              {isRegister
                ? "Sign in"
                : "Create a free account"}
            </button>

          </div>

          {/* DISCLAIMER */}
          <div className="auth-disclaimer">

            <ShieldCheck size={14} />

            <span>
              CareBridge is a healthcare decision-support
              tool and does not replace professional medical advice.
            </span>

          </div>

        </div>

      </section>

    </div>
  );
}
