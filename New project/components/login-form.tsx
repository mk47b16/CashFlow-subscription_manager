"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, BarChart3, LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) {
      setMessage("Supabase is not configured. Check .env.local.");
      setError(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setError(false);
    const result =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      setError(true);
      return;
    }
    if (!result.data.session) {
      setMessage("Account created. Confirm your email, then return here to sign in.");
      setError(false);
      // Auto-switch to signin mode after a successful signup.
      setTimeout(() => {
        setMode("signin");
        setMessage("");
      }, 2000);
      return;
    }
    router.push("/");
    router.refresh();
  };

  // Sends a password reset email when the user clicks "Forgot password?".
  const handleReset = async () => {
    if (!email) {
      setMessage("Enter your email above to reset your password.");
      setError(true);
      return;
    }
    if (!supabase) {
      setMessage("Supabase is not configured. Check .env.local.");
      setError(true);
      return;
    }
    setBusy(true);
    setMessage("");
    setError(false);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (resetError) {
      setMessage(resetError.message);
      setError(true);
      return;
    }
    setMessage("Password reset link sent. Check your email.");
    setError(false);
  };

  return (
    <main className="login-page">
      <section className="login-showcase">
        <div className="login-brand">
          <span>
            <Sparkles size={19} />
          </span>
          Cash<span>Flow</span>
        </div>
        <div>
          <p className="eyebrow">PERSONAL FINANCE, MADE CLEAR</p>
          <h1>See every subscription before it quietly drains your account.</h1>
          <p>
            Track live transactions, detect recurring payments, and understand exactly where your money goes.
          </p>
        </div>
        <div className="login-benefits">
          <span>
            <BarChart3 size={17} /> Live spending charts
          </span>
          <span>
            <LockKeyhole size={17} /> Private, user-owned data
          </span>
        </div>
      </section>
      <section className="login-card">
        <div>
          <p className="eyebrow">WELCOME TO CASHFLOW</p>
          <h2>{mode === "signin" ? "Sign in to your dashboard" : "Create your private dashboard"}</h2>
          <p>
            {mode === "signin"
              ? "Your subscriptions and transactions will sync in real time."
              : "Use your email to create a secure CashFlow workspace."}
          </p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!error}
              aria-describedby="login-error"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={!!error}
              aria-describedby="login-error"
            />
          </label>
          {message && (
            <p id="login-error" className="auth-message">
              {message}
            </p>
          )}
          <button className="primary-btn auth-submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? <>Sign in <ArrowRight size={16} /></> : "Create account"}
          </button>
          {mode === "signin" && (
            <button type="button" className="auth-reset" onClick={handleReset} disabled={busy}>
              Forgot password?
            </button>
          )}
        </form>
        <button
          className="auth-toggle"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setMessage("");
            setError(false);
          }}
        >
          {mode === "signin" ? "New to CashFlow? Create an account" : "Already have an account? Sign in"}
        </button>
      </section>
    </main>
  );
}
