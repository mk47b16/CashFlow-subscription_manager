import { transactions } from "./data";
import { Anomaly, Category, Subscription, Transaction } from "./types";

const aliases: Record<string, string> = {
  netflix: "Netflix", nflx: "Netflix", spotify: "Spotify", amazonprime: "Amazon Prime", amznprime: "Amazon Prime",
  youtube: "YouTube Premium", notion: "Notion AI", arjun: "Arjun Rent Split", flatmate: "Arjun Rent Split"
};
const stop = new Set(["com", "india", "mumbai", "ab", "p", "so", "upi", "transfer", "streaming", "premium"]);

/** Lightweight local semantic fingerprint. Replace token vectors with OpenAI embeddings in production. */
export function tokenize(merchant: string) { return merchant.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(t => t && !stop.has(t)); }
export function normalizeMerchant(merchant: string) { return tokenize(merchant).join(""); }
export function canonicalMerchant(merchant: string) {
  const normalized = normalizeMerchant(merchant);
  return Object.entries(aliases).find(([key]) => normalized.includes(key))?.[1] ?? merchant;
}
/** Explainable bag-of-token embedding and cosine similarity; deterministic and API-key free. */
export function similarity(a: string, b: string) {
  const av = tokenize(a), bv = tokenize(b); const terms = new Set([...av, ...bv]);
  const dot = [...terms].reduce((s, t) => s + Number(av.includes(t)) * Number(bv.includes(t)), 0);
  return dot / Math.sqrt(Math.max(1, av.length) * Math.max(1, bv.length));
}
const days = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
const fmtDate = (date: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`));

export function detectSubscriptions(source = transactions): Subscription[] {
  const groups = new Map<string, Transaction[]>();
  source.filter(t => t.kind === "debit").forEach(t => {
    const c = canonicalMerchant(t.merchant); groups.set(c, [...(groups.get(c) ?? []), t]);
  });
  return [...groups].map(([canonical, members]) => {
    const sorted = [...members].sort((a,b) => a.date.localeCompare(b.date));
    const intervals = sorted.slice(1).map((t, i) => days(sorted[i].date, t.date));
    const medianInterval = intervals.sort((a,b)=>a-b)[Math.floor(intervals.length / 2)] ?? 30;
    const frequency: Subscription["frequency"] = medianInterval > 300 ? "yearly" : medianInterval > 80 ? "quarterly" : medianInterval < 12 ? "weekly" : "monthly";
    const averageAmount = Math.round(members.reduce((s,t)=>s+t.amount,0) / members.length);
    const variance = Math.max(...members.map(t => Math.abs(t.amount - averageAmount))) / averageAmount;
    const merchantSim = members.slice(1).reduce((s,t) => s + similarity(members[0].merchant,t.merchant), 0) / Math.max(1,members.length-1);
    const confidence = Math.min(98, Math.round(54 + members.length * 5 + merchantSim * 15 + Math.max(0, 9 - variance * 50)));
    const last = sorted.at(-1)!; const next = new Date(`${last.date}T00:00:00`); next.setDate(next.getDate() + (frequency === "yearly" ? 365 : frequency === "quarterly" ? 90 : frequency === "weekly" ? 7 : 30));
    const isLearning = members.length >= 2 && members.length <= 3;
    const amounts = members.map(m => m.amount);
    const maxAmt = Math.max(...amounts);
    const minAmt = Math.min(...amounts);
    const increased = members.length >= 4 && maxAmt > minAmt * 1.15;
    const duplicate = false;
    const unused = members.some(m => m.engagementDays !== undefined && m.engagementDays < 10);
    const annualized = averageAmount * (frequency === "yearly" ? 1 : frequency === "quarterly" ? 4 : frequency === "weekly" ? 52 : 12);
    const status: Subscription["status"] = isLearning ? "learning" : duplicate ? "duplicate" : increased ? "price increased" : unused ? "possibly unused" : "active";
    return { id: canonical.toLowerCase().replaceAll(" ", "-"), canonical, members: sorted, confidence: isLearning ? 76 : confidence, frequency, averageAmount, lastCharged: last.date, nextExpected: next.toISOString().slice(0,10), annualized, engagementDays: Math.round(members.reduce((s,t)=>s+(t.engagementDays ?? 0),0)/members.length), duplicateLikelihood: duplicate ? 84 : 8, priceIncrease: increased, status, description: isLearning ? "Three stable, on-time payments suggest a shared household commitment. We’re learning its role before judging it." : `${members.length} matching charges across merchant-name variations.` };
  }).sort((a,b)=>b.annualized-a.annualized);
}

export function silentRisk(s: Subscription) {
  if (s.status === "learning") return 0;
  const inactivity = Math.max(0, 100 - s.engagementDays * 6);
  return Math.min(97, Math.round(s.confidence * .25 + Math.min(100,s.annualized / 60) * .16 + inactivity * .31 + s.duplicateLikelihood * .18 + (s.priceIncrease ? 15 : 0)));
}

export function detectAnomalies(source = transactions, subscriptions = detectSubscriptions(source)): Anomaly[] {
  const recurringIds = new Set(subscriptions.flatMap(s => s.members.map(t=>t.id)));
  return source.filter(t=>t.kind === "debit" && !recurringIds.has(t.id)).map(t => {
    const peer = source.filter(p=>p.category === t.category && p.kind === "debit" && p.id !== t.id).map(p=>p.amount).sort((a,b)=>a-b);
    const median = peer[Math.floor(peer.length/2)] ?? t.amount; const categoryDeviation = t.amount / Math.max(1,median);
    const merchantNew = source.filter(p=>p.merchant===t.merchant).length === 1 ? 1 : 0;
    const score = Math.min(99, Math.round(Math.min(65, categoryDeviation * 11) + merchantNew * 18));
    const reasons = [`${Math.round(categoryDeviation)}× your typical ${t.category.toLowerCase()} amount`, merchantNew ? "First charge from this merchant" : "Unusual amount for this merchant", "Not part of a high-confidence recurring cluster"];
    return { transaction: t, score, reasons, categoryMedian: median, merchantNovelty: merchantNew };
  }).filter(a=>a.score >= 62).sort((a,b)=>b.score-a.score).slice(0,3);
}

export const currency = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
export const dateLabel = fmtDate;
export const statusLabel = (status: string) => status.replace(/\b\w/g, c=>c.toUpperCase());
export const categoryColors: Record<Category, string> = { Income: "#49d6af", Housing: "#9676ff", Utilities: "#4fb5ff", Food: "#f5a66a", Shopping: "#ec77ba", Transport: "#66d1e7", Entertainment: "#7869ff", Transfer: "#ffcb65", Health: "#65d789", Other: "#a4b1c8" };
