"use client";

import { FormEvent, useState } from "react";
import { X } from "lucide-react";
import { Transaction } from "../lib/types";

type Preset = { label: string; merchant: string; amount: number; category: Transaction["category"]; frequency: "monthly" | "yearly" };
const presets: Preset[] = [
  { label: "Netflix", merchant: "NETFLIX.COM", amount: 649, category: "Entertainment", frequency: "monthly" },
  { label: "Spotify", merchant: "SPOTIFY P", amount: 119, category: "Entertainment", frequency: "monthly" },
  { label: "YouTube Premium", merchant: "YOUTUBE*PREMIUM", amount: 129, category: "Entertainment", frequency: "monthly" },
  { label: "Amazon Prime", merchant: "AMZN Prime", amount: 1499, category: "Shopping", frequency: "yearly" },
  { label: "Notion AI", merchant: "NOTION.SO", amount: 800, category: "Other", frequency: "monthly" },
  { label: "Custom subscription", merchant: "", amount: 0, category: "Other", frequency: "monthly" }
];

export type SubscriptionEntry = { merchant: string; amount: number; category: Transaction["category"]; date: string; frequency: "monthly" | "yearly"; type: string };

export function AddSubscriptionModal({ onClose, onSave }: { onClose: () => void; onSave: (entry: SubscriptionEntry) => Promise<void> }) {
  const [selected, setSelected] = useState(presets[0]);
  const [merchant, setMerchant] = useState(presets[0].merchant);
  const [amount, setAmount] = useState(String(presets[0].amount));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<"monthly" | "yearly">(presets[0].frequency);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = (label: string) => {
    const preset = presets.find(item => item.label === label) ?? presets[0];
    setSelected(preset); setMerchant(preset.merchant); setAmount(String(preset.amount)); setFrequency(preset.frequency);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!merchant.trim() || Number(amount) <= 0) { setError("Enter a merchant and a valid amount."); return; }
    setBusy(true);
    try { await onSave({ merchant: merchant.trim(), amount: Number(amount), category: selected.category, date, frequency, type: selected.label }); onClose(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save this subscription."); }
    finally { setBusy(false); }
  };

  return <div className="drawer-backdrop" role="presentation" onClick={onClose}><section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-title" onClick={event => event.stopPropagation()}>
    <button className="close-btn" onClick={onClose} aria-label="Close subscription form"><X size={20}/></button>
    <p className="eyebrow">LIVE TRANSACTION ENTRY</p><h2 id="entry-title">Add a subscription</h2><p className="auth-copy">Choose a service or add your own. CashFlow recalculates your recurring spend and charts as soon as it is saved.</p>
    <form className="entry-form" onSubmit={submit}>
      <label>Subscription type<select value={selected.label} onChange={event => choose(event.target.value)}>{presets.map(preset => <option key={preset.label}>{preset.label}</option>)}</select></label>
      <div className="form-pair"><label>Merchant<input value={merchant} onChange={event => setMerchant(event.target.value)} placeholder="e.g. Netflix India" required /></label><label>Amount (₹)<input type="number" min="1" value={amount} onChange={event => setAmount(event.target.value)} required /></label></div>
      <div className="form-pair"><label>Charged on<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><label>Billing frequency<select value={frequency} onChange={event => setFrequency(event.target.value as "monthly" | "yearly")}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label></div>
      {error && <p className="auth-message">{error}</p>}<button className="primary-btn auth-submit" disabled={busy}>{busy ? "Saving…" : "Save subscription"}</button>
    </form>
  </section></div>;
}
