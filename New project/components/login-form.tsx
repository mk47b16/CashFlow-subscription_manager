"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, BarChart3, LockKeyhole, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

// Map raw Supabase auth error messages to friendly, user-facing copy.
function friendlyAuthMessage(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("invalid login credentials")) return "Wrong email or password";
  if (text.includes("email not confirmed")) return "Confirm your email before signing in";
  if (text.includes("user already registered")) return "An account with this email already exists";
  if (text.includes("password should be at least")) return "Password must be at least 6 characters";
  if (text.includes("rate limit") || text.includes("too many")) return "Too many attempts. Please wait a moment and try again";
  if (text.includes("network") || text.includes("failed to fetch")) return "Network error. Check your connection and try again";
  return raw;
}

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase?.auth.getSession().then(({ data }) => { if (data.session) router.replace("/"); }); }, [router]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!supabase) { setMessage("Supabase is not configured. Check .env.local."); return; }
    setBusy(true); setMessage("");
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) { setMessage(friendlyAuthMessage(result.error.message)); return; }
    if (!result.data.session) { setMessage("Account created. Confirm your email, then return here to sign in."); return; }
    router.push("/"); router.refresh();
  };

  return <main className="login-page"><section className="login-showcase"><div className="login-brand"><span><Sparkles size={19}/></span>Cash<span>Flow</span></div><div><p className="eyebrow">PERSONAL FINANCE, MADE CLEAR</p><h1>See every subscription before it quietly drains your account.</h1><p>Track live transactions, detect recurring payments, and understand exactly where your money goes.</p></div><div className="login-benefits"><span><BarChart3 size={17}/> Live spending charts</span><span><LockKeyhole size={17}/> Private, user-owned data</span></div></section><section className="login-card"><div><p className="eyebrow">WELCOME TO CASHFLOW</p><h2>{mode === "signin" ? "Sign in to your dashboard" : "Create your private dashboard"}</h2><p>{mode === "signin" ? "Your subscriptions and transactions will sync in real time." : "Use your email to create a secure CashFlow workspace."}</p></div><form className="auth-form" onSubmit={submit}><label>Email<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={event => setPassword(event.target.value)} /></label>{message && <p className="auth-message">{message}</p>}<button className="primary-btn auth-submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? <>Sign in <ArrowRight size={16}/></> : "Create account"}</button></form><button className="auth-toggle" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "New to CashFlow? Create an account" : "Already have an account? Sign in"}</button></section></main>;
}
