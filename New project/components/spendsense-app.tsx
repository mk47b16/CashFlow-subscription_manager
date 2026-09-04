"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Bell, BrainCircuit, CalendarDays, Check, ChevronRight, CircleHelp, CreditCard, DollarSign, Menu, Plus, ScanLine, ShieldCheck, Sparkles, X, Zap } from "lucide-react";
import { transactions } from "../lib/data";
import { categoryColors, currency, dateLabel, detectAnomalies, detectSubscriptions, silentRisk, statusLabel } from "../lib/intelligence";
import { Anomaly, Subscription, Transaction } from "../lib/types";
import { supabase } from "../lib/supabase";
import { AddSubscriptionModal, SubscriptionEntry } from "./add-subscription-modal";

type View = "dashboard" | "subscriptions";
type Scenario = "Young professional" | "Shared apartment" | "Power subscriber";
const scenarios: Scenario[] = ["Young professional", "Shared apartment", "Power subscriber"];

function Tone({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "risk" | "good" | "learning" }) { return <span className={`tone ${tone}`}>{children}</span>; }

export function CashFlowApp() {
  const [view, setView] = useState<View>("dashboard");
  const [scenario, setScenario] = useState<Scenario>("Young professional");
  const [scanning, setScanning] = useState(false);
  const [scanStage, setScanStage] = useState(3);
  const [chartsReady, setChartsReady] = useState(false);
  const [liveTransactions, setLiveTransactions] = useState<Transaction[]>(transactions);
  const [dataSource, setDataSource] = useState<"demo" | "live" | "connected-empty">("demo");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [selected, setSelected] = useState<Subscription | Anomaly | null>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [classifications, setClassifications] = useState<Record<string, string>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const subscriptions = useMemo(() => detectSubscriptions(liveTransactions), [liveTransactions]);
  const anomalies = useMemo(() => detectAnomalies(liveTransactions, subscriptions), [liveTransactions, subscriptions]);
  const visibleSubscriptions = subscriptions.filter(s => !dismissed.includes(s.id));
  const alerts = visibleSubscriptions.filter(s => silentRisk(s) >= 50);
  const latestMonth = liveTransactions.reduce((latest, transaction) => transaction.date.slice(0, 7) > latest ? transaction.date.slice(0, 7) : latest, "");
  const availableMonths = [...new Set(liveTransactions.filter(t => t.kind === "debit").map(t => t.date.slice(0, 7)))].sort();
  const selectedMonthKey = activeMonth ?? latestMonth;
  const currentMonth = liveTransactions.filter(t => t.date.startsWith(selectedMonthKey) && t.kind === "debit");
  const currentMonthLabel = selectedMonthKey ? new Intl.DateTimeFormat("en-IN", { month: "long" }).format(new Date(`${selectedMonthKey}-01T00:00:00`)) : "Current month";
  const monthlySpend = currentMonth.reduce((sum, t) => sum + t.amount, 0);
  const learningCount = subscriptions.filter(s => s.status === "learning").length;
  const potentialSavings = alerts.reduce((sum, s) => sum + (s.status === "duplicate" || s.status === "possibly unused" ? s.averageAmount : 0), 0);
  const navigate = (next: View) => { setView(next); setSidebarOpen(false); };

  useEffect(() => {
    if (!scanning) return;
    setScanStage(0);
    const timers = [450, 1050, 1650].map((delay, i) => window.setTimeout(() => setScanStage(i + 1), delay));
    const done = window.setTimeout(() => setScanning(false), 2050);
    return () => { timers.forEach(clearTimeout); clearTimeout(done); };
  }, [scanning]);

  useEffect(() => { setChartsReady(true); }, []);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;
    const refresh = async () => {
      const { data: sessionData } = await client.auth.getSession();
      const session = sessionData.session;
      if (!mounted) return;
      setSessionEmail(session?.user.email ?? null);
      if (!session) { setDataSource("demo"); setLiveTransactions(transactions); return; }
      const { data, error } = await client.from("transactions").select("id,date,merchant,amount,category,kind,engagement_days").order("date", { ascending: true });
      if (!mounted) return;
      if (error) { setDataSource("demo"); return; }
      const rows: Transaction[] = (data ?? []).map(row => ({ id: row.id, date: row.date, merchant: row.merchant, amount: Number(row.amount), category: row.category as Transaction["category"], kind: row.kind as Transaction["kind"], engagementDays: row.engagement_days ?? undefined }));
      setLiveTransactions(rows.length ? rows : transactions);
      setDataSource(rows.length ? "live" : "connected-empty");
    };
    refresh();
    const authListener = client.auth.onAuthStateChange(() => { window.setTimeout(refresh, 0); });
    const channel = client.channel("cashflow-transactions-live").on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => refresh()).subscribe();
    return () => { mounted = false; authListener.data.subscription.unsubscribe(); void client.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (!selected && !entryOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelected(null); setEntryOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, entryOpen]);

  const runScan = () => { setScanning(true); setDismissed([]); };
  const keep = (id: string) => { setDismissed(d => [...d, id]); setSelected(null); };
  const addSubscription = async (entry: SubscriptionEntry) => {
    const client = supabase;
    const localTransaction: Transaction = { id: `manual-${Date.now()}`, date: entry.date, merchant: entry.merchant, amount: entry.amount, category: entry.category, kind: "debit", engagementDays: 0 };
    if (!client) { setLiveTransactions(previous => [...previous, localTransaction].sort((a, b) => a.date.localeCompare(b.date))); return; }
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) { setLiveTransactions(previous => [...previous, localTransaction].sort((a, b) => a.date.localeCompare(b.date))); return; }
    const { data, error } = await client.from("transactions").insert({ user_id: sessionData.session.user.id, date: entry.date, merchant: entry.merchant, amount: entry.amount, category: entry.category, kind: "debit", engagement_days: 0 }).select("id,date,merchant,amount,category,kind,engagement_days").single();
    if (error) throw new Error(error.message);
    const saved: Transaction = { id: data.id, date: data.date, merchant: data.merchant, amount: Number(data.amount), category: data.category as Transaction["category"], kind: data.kind as Transaction["kind"], engagementDays: data.engagement_days ?? undefined };
    setLiveTransactions(previous => [...previous, saved].sort((a, b) => a.date.localeCompare(b.date)));
    setDataSource("live");
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setSessionEmail(null);
    setDataSource("demo");
    setLiveTransactions(transactions);
  };

  return <main className="app-shell">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
      <button className="sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={20}/></button>
      <div className="brand"><span className="brand-mark"><Sparkles size={18}/></span><span>Cash<span>Flow</span></span></div>
      <nav aria-label="Primary navigation">
        <button className={view === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => navigate("dashboard")}><Zap size={18}/> Overview</button>
        <button className={view === "subscriptions" ? "nav-item active" : "nav-item"} onClick={() => navigate("subscriptions")}><CreditCard size={18}/> Subscription intelligence</button>
        <button className="nav-item" disabled={anomalies.length === 0} onClick={() => { if (anomalies[0]) setSelected(anomalies[0]); setSidebarOpen(false); }}><AlertTriangle size={18}/> Anomaly watch <em>{anomalies.length}</em></button>
      </nav>
      <div className="privacy-card"><ShieldCheck size={18}/><div><strong>Private by design</strong><p>Your demo data stays local.</p></div></div>
      <div className="sidebar-footer">
        <div className="sidebar-status-row">
          {sessionEmail || dataSource === "live" ? (
            <button className="data-status" onClick={logout}><span className="status-dot"/>Logout</button>
          ) : (
            <Link href="/login" className="data-status"><span className="status-dot"/>Login</Link>
          )}
          <button className="icon-btn" aria-label={`Notifications, ${alerts.length} unread`} title={`${alerts.length} subscription${alerts.length === 1 ? "" : "s"} to review`} onClick={() => { if (alerts[0]) setSelected(alerts[0]); else navigate("subscriptions"); setSidebarOpen(false); }}><Bell size={18}/>{alerts.length > 0 && <i/>}</button>
        </div>
        <div className="persona"><span className="avatar">MS</span><div><strong>{sessionEmail || "Marmik S."}</strong><small>{dataSource === "live" ? "Live data connected" : "Young professional"}</small></div></div>
      </div>
    </aside>
    {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}
    <section className="content" id="main-content">
      <header className="topbar">
        <button className="menu-btn" aria-label="Open navigation" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(o => !o)}><Menu size={20}/></button>
        <div><p className="eyebrow">YOUR MONEY, MADE CLEARER</p><h1>{view === "dashboard" ? "Good afternoon, Marmik" : "Subscription intelligence"}</h1></div>
        <div className="header-actions"><label className="month-select"><CalendarDays size={16}/><select value={selectedMonthKey} aria-label="Select month" onChange={event => setActiveMonth(event.target.value)}>{availableMonths.slice().reverse().map(month => <option key={month} value={month}>{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${month}-01T00:00:00`))}</option>)}</select></label><button onClick={runScan} disabled={scanning} className="scan-btn"><ScanLine size={17}/>{scanning ? "Scanning…" : "Run AI Scan"}</button></div>
      </header>
      <div className="scenario-row"><div className="scenario-toggle"><span className="scenario-label">Demo scenario</span><div className="scenario-segmented">{scenarios.map(option => <button key={option} onClick={() => setScenario(option)} className={scenario === option ? "scenario selected" : "scenario"}>{option}</button>)}</div></div><span className="scenario-copy">{scenario === "Shared apartment" ? "Rent split is protected as a new shared commitment." : scenario === "Power subscriber" ? "More overlap signals surfaced for a subscription-heavy life." : "Balanced spending patterns with realistic drift."}</span></div>
      {scanning ? <ScanProgress stage={scanStage}/> : view === "dashboard" ? <Dashboard dataset={liveTransactions} currentMonthLabel={currentMonthLabel} selectedMonthKey={selectedMonthKey} subscriptions={visibleSubscriptions} anomalies={anomalies} monthlySpend={monthlySpend} potentialSavings={potentialSavings} learningCount={learningCount} alertsCount={alerts.length} chartsReady={chartsReady} showAllRecent={showAllRecent} onToggleShowAll={() => setShowAllRecent(v => !v)} onSelect={setSelected} onNavigate={() => setView("subscriptions")}/> : <Subscriptions subscriptions={visibleSubscriptions} onSelect={setSelected} onKeep={keep} classifications={classifications} setClassifications={setClassifications} onAdd={() => setEntryOpen(true)}/>}
    </section>
    {selected && <ExplainDrawer item={selected} classification={"id" in selected ? classifications[selected.id] : undefined} onClose={() => setSelected(null)} onKeep={keep} setClassification={(value) => "id" in selected && setClassifications(c => ({...c, [selected.id]: value}))}/>}
    {entryOpen && <AddSubscriptionModal onClose={() => setEntryOpen(false)} onSave={addSubscription}/>}
  </main>;
}

function ScanProgress({ stage }: { stage: number }) {
  const steps = ["Normalizing 218 transaction descriptions", "Matching semantic merchant fingerprints", "Separating recurring commitments from anomalies"];
  return <section className="scan-state panel"><div className="scan-orb"><BrainCircuit size={33}/></div><div><p className="eyebrow">CASHFLOW INTELLIGENCE</p><h2>Finding the story behind your spending</h2><div className="scan-steps">{steps.map((s, i) => <p key={s} className={i < stage ? "done" : i === stage ? "now" : ""}>{i < stage ? <Check size={16}/> : <span>{i + 1}</span>}{s}</p>)}</div></div></section>
}

function Dashboard({ dataset, currentMonthLabel, selectedMonthKey, subscriptions, anomalies, monthlySpend, potentialSavings, learningCount, alertsCount, chartsReady, showAllRecent, onToggleShowAll, onSelect, onNavigate }: { dataset: Transaction[]; currentMonthLabel: string; selectedMonthKey: string; subscriptions: Subscription[]; anomalies: Anomaly[]; monthlySpend: number; potentialSavings: number; learningCount: number; alertsCount: number; chartsReady: boolean; showAllRecent: boolean; onToggleShowAll: () => void; onSelect: (item: Subscription | Anomaly) => void; onNavigate: () => void }) {
  const monthKeys = [...new Set(dataset.filter(t=>t.kind === "debit").map(t=>t.date.slice(0, 7)))].sort().slice(-10);
  const trends = monthKeys.map(month => ({ month: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(`${month}-01T00:00:00`)), spend: dataset.filter(t=>t.kind === "debit" && t.date.startsWith(month)).reduce((sum,t)=>sum+t.amount,0) }));
  const monthIndex = monthKeys.indexOf(selectedMonthKey);
  const previousMonthKey = monthIndex > 0 ? monthKeys[monthIndex - 1] : null;
  const previousSpend = previousMonthKey ? dataset.filter(t=>t.kind === "debit" && t.date.startsWith(previousMonthKey)).reduce((sum,t)=>sum+t.amount,0) : 0;
  const spendDelta = previousMonthKey ? monthlySpend - previousSpend : 0;
  const spendDeltaLabel = previousMonthKey ? `${spendDelta < 0 ? "↓" : "↑"} ${currency(Math.abs(spendDelta))} vs ${new Intl.DateTimeFormat("en-IN", { month: "short" }).format(new Date(`${previousMonthKey}-01T00:00:00`))}` : "First month on record";
  const categoryData = Object.entries(dataset.filter(t=>t.date.startsWith(selectedMonthKey) && t.kind === "debit").reduce<Record<string, number>>((a,t)=>{a[t.category]=(a[t.category]||0)+t.amount;return a;},{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const monthDebits = [...dataset].filter(t=>t.date.startsWith(selectedMonthKey) && t.kind === "debit").sort((a,b)=>b.date.localeCompare(a.date));
  const recent = showAllRecent ? monthDebits : monthDebits.slice(0,5);
  return <div className="dashboard-page">
    <section className="metric-grid">
      <Metric icon={<ArrowUpRight/>} label={`${currentMonthLabel} spend`} value={currency(monthlySpend)} trend={spendDeltaLabel} tone={previousMonthKey ? (spendDelta <= 0 ? "good" : "risk") : "good"}/>
      <Metric icon={<DollarSign/>} label="Potential monthly savings" value={currency(potentialSavings)} trend={`${alertsCount} subscription${alertsCount === 1 ? "" : "s"} to review`} tone="risk"/>
      <Metric icon={<CreditCard/>} label="Recurring commitments" value={String(subscriptions.length)} trend={learningCount > 0 ? `${learningCount} new commitment${learningCount === 1 ? "" : "s"} learning` : "All confirmed"} tone="learning"/>
      <Metric icon={<AlertTriangle/>} label="Spending anomalies" value={String(anomalies.length)} trend={anomalies.length ? "Needs a quick look" : "Nothing unusual"} tone="risk"/>
    </section>
    <section className="dashboard-grid"><div className="panel trend-panel"><div className="panel-head"><div><p className="eyebrow">SPENDING RHYTHM</p><h2>Monthly outflow</h2></div></div><div className="chart">{chartsReady ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={trends}><defs><linearGradient id="spend" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9c6b4b" stopOpacity=".4"/><stop offset="1" stopColor="#9c6b4b" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="month" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={20}/><YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => currency(v).replace(/\.\d+/, "")} style={{fontSize:10}}/><Tooltip formatter={(v: number) => currency(v)} contentStyle={{background:"#f7f1e8",border:"1px solid #c8b7a6",borderRadius:12,color:"#2e2a26"}}/><Area dataKey="spend" type="monotone" stroke="#9c6b4b" strokeWidth={2.5} fill="url(#spend)"/></AreaChart></ResponsiveContainer> : <div className="chart-placeholder" aria-label="Loading monthly spending chart"/>}</div></div>
      <div className="panel insight-panel"><div className="panel-head"><div><p className="eyebrow">AI INSIGHTS</p><h2>Worth your attention</h2></div><Sparkles className="sparkle" size={20}/></div>{subscriptions.filter(s=>silentRisk(s)>55).slice(0,2).map(s=><button className="insight" key={s.id} onClick={()=>onSelect(s)}><span className="insight-icon"><BrainCircuit size={17}/></span><span><strong>{s.canonical}: {s.status === "duplicate" ? "overlapping coverage detected" : "low recent usage"}</strong><small>{s.status === "duplicate" ? `Keeping both streaming plans may cost ₹${s.annualized.toLocaleString("en-IN")}/year.` : `Reviewing it could save ₹${s.annualized.toLocaleString("en-IN")}/year.`}</small></span><ChevronRight size={17}/></button>)}<button className="text-link" onClick={onNavigate}>See subscription intelligence <ChevronRight size={15}/></button></div>
      <div className="panel categories-panel"><div className="panel-head"><div><p className="eyebrow">THIS MONTH</p><h2>Where it went</h2></div></div><div className="donut-wrap">{chartsReady ? <PieChart width={150} height={150}><Pie data={categoryData} dataKey="value" innerRadius={48} outerRadius={69} paddingAngle={3}>{categoryData.map(entry=><Cell key={entry.name} fill={categoryColors[entry.name as keyof typeof categoryColors]}/>)}</Pie><Tooltip formatter={(v: number)=>currency(v)} contentStyle={{background:"#101c39",border:"1px solid #2a3b61",borderRadius:12}}/></PieChart> : <div className="donut-placeholder" aria-label="Loading category spending chart"/>}<div className="legend">{categoryData.slice(0,4).map(c=><span key={c.name}><i style={{background:categoryColors[c.name as keyof typeof categoryColors]}}/>{c.name}<b>{currency(c.value)}</b></span>)}</div></div></div>
      <div className="panel recent-panel"><div className="panel-head"><div><p className="eyebrow">LIVE FEED</p><h2>Recent transactions</h2></div><button className="text-link" onClick={onToggleShowAll}>{showAllRecent ? "Show fewer" : "View all"}</button></div>{recent.map(t=><TransactionRow key={t.id} transaction={t}/>)}</div>
      <div className="panel anomaly-panel"><div className="panel-head"><div><p className="eyebrow">ANOMALY WATCH</p><h2>Unusual, not assumed wrong</h2></div><Tone tone="risk">{anomalies.length} found</Tone></div>{anomalies.slice(0,2).map(a=><button className="anomaly-row" key={a.transaction.id} onClick={()=>onSelect(a)}><span className="merchant-icon danger"><AlertTriangle size={16}/></span><span><strong>{a.transaction.merchant}</strong><small>{a.reasons[0]}</small></span><b>{currency(a.transaction.amount)}</b><ChevronRight size={16}/></button>)}</div>
    </section>
  </div>;
}

function Metric({ icon, label, value, trend, tone }: {icon: React.ReactNode; label: string; value: string; trend: string; tone: "good" | "risk" | "learning"}) { return <article className="metric panel"><span className={`metric-icon ${tone}`}>{icon}</span><p>{label}</p><h2>{value}</h2><small className={tone}>{trend}</small></article>; }

function Subscriptions({ subscriptions, onSelect, onKeep, classifications, setClassifications, onAdd }: { subscriptions: Subscription[]; onSelect: (s: Subscription)=>void; onKeep:(id:string)=>void; classifications: Record<string,string>; setClassifications:(c:Record<string,string>)=>void; onAdd: () => void }) {
  const monthly = subscriptions.filter(s=>s.frequency === "monthly").reduce((a,s)=>a+s.averageAmount,0);
  return <div className="subscriptions-page"><section className="subscription-hero panel"><div><p className="eyebrow">LOCAL, EXPLAINABLE AI</p><h2>We found {subscriptions.length} recurring commitments</h2><p>Names change. Billing dates drift. CashFlow groups what truly belongs together—then separates it from unusual one-off spend.</p></div><div className="hero-stat"><span>Monthly commitments</span><strong>{currency(monthly)}</strong><small>{currency(monthly * 12)} annualized</small></div></section><section className="avoid-card"><ShieldCheck size={22}/><div><h3>How we avoid false positives</h3><p>A new repeated charge with stable timing, amount, and payee semantics is labeled <b>“New recurring commitment — learning”</b>. It never enters your savings total until low value, duplicate coverage, or your confirmation creates stronger evidence.</p></div></section><section className="subscription-table panel"><div className="panel-head"><div><p className="eyebrow">DETECTED PATTERNS</p><h2>Recurring charge map</h2></div><div className="panel-head-actions"><button className="entry-btn" onClick={onAdd}><Plus size={16}/> Add subscription</button><span className="confidence-key">● High confidence &nbsp; ◇ Learning</span></div></div><div className="table-wrap"><table><thead><tr><th>Commitment</th><th>Pattern</th><th>Average charge</th><th>Next expected</th><th>Status</th><th></th></tr></thead><tbody>{subscriptions.map(s=><tr key={s.id}><td><button className="merchant-cell" onClick={()=>onSelect(s)}><span className="merchant-icon">{s.canonical.slice(0,1)}</span><span><strong>{s.canonical}</strong><small>{s.confidence}% matching confidence</small></span></button></td><td><span>{statusLabel(s.frequency)}</span><small>{s.members.length} charges · last {dateLabel(s.lastCharged)}</small></td><td><strong>{currency(s.averageAmount)}</strong><small>{currency(s.annualized)}/yr</small></td><td>{dateLabel(s.nextExpected)}</td><td><Tone tone={s.status === "active" ? "good" : s.status === "learning" ? "learning" : "risk"}>{statusLabel(s.status)}</Tone></td><td><button className="row-action" onClick={()=>onSelect(s)} aria-label={`Explain ${s.canonical}`}><ChevronRight size={18}/></button></td></tr>)}</tbody></table></div></section><section className="commitment-card panel"><div><p className="eyebrow">NEW RECURRING COMMITMENT</p><h2>Arjun Rent Split is learning, not flagged</h2><p>Three predictable ₹14,500 payments suggest a shared expense. How should CashFlow treat it?</p></div><div className="classify-buttons">{["Essential", "Shared expense", "Subscription", "Review later"].map(value=><button key={value} onClick={()=>setClassifications({...classifications,"arjun-rent-split":value})} className={classifications["arjun-rent-split"] === value ? "selected" : ""}>{classifications["arjun-rent-split"] === value && <Check size={14}/>} {value}</button>)}</div></section></div>;
}

function TransactionRow({ transaction }: { transaction: Transaction }) { return <div className="transaction-row"><span className="merchant-icon"><ArrowDownLeft size={16}/></span><span><strong>{transaction.merchant}</strong><small>{transaction.category} · {dateLabel(transaction.date)}</small></span><b>−{currency(transaction.amount)}</b></div>; }

function ExplainDrawer({ item, classification, onClose, onKeep, setClassification }: { item: Subscription | Anomaly; classification?: string; onClose:()=>void; onKeep:(id:string)=>void; setClassification:(value:string)=>void }) {
  const subscription = "members" in item; const s = subscription ? item as Subscription : null; const a = subscription ? null : item as Anomaly;
  const title = s?.canonical ?? a!.transaction.merchant;
  const similarityScore = s ? Math.round(s.members.slice(1).reduce((sum,t)=>sum + (t.merchant.toLowerCase().includes(s.canonical.toLowerCase().split(" ")[0].toLowerCase()) ? 93 : 71),0) / Math.max(1,s.members.length-1)) : 0;
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer) return;
    const focusable = drawer.querySelectorAll('button, a, select, input, [tabindex]:not([tabindex="-1"])');
    if (focusable.length === 0) return;
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    first.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    drawer.addEventListener('keydown', trap);
    return () => drawer.removeEventListener('keydown', trap);
  }, []);
  return <div className="drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="drawer" ref={drawerRef} role="dialog" aria-modal="true" aria-labelledby="drawer-title" onMouseDown={e=>e.stopPropagation()}><button className="close-btn" onClick={onClose} aria-label="Close details"><X size={20}/></button><p className="eyebrow">WHY WAS THIS FLAGGED?</p><h2 id="drawer-title">{title}</h2>{s ? <><div className="drawer-summary"><span className="merchant-icon big">{title[0]}</span><div><strong>{currency(s.averageAmount)} / {s.frequency}</strong><p>{s.status === "learning" ? "New recurring commitment — learning" : `${s.confidence}% recurring confidence`}</p></div></div><p className="drawer-copy">{s.status === "possibly unused" ? `You have paid ${currency(s.averageAmount)}/month to ${s.canonical} for ${s.members.length} months. No usage was recorded in the last 60 days. Reviewing it could save ${currency(s.annualized)}/year.` : s.status === "duplicate" ? `${s.canonical} overlaps with your Netflix entertainment coverage. There’s a strong chance you only need one paid streaming plan.` : s.description}</p><div className="evidence"><Evidence label="Similar merchant examples" value={s.members.slice(0,3).map(t=>t.merchant).join(" · ")}/><Evidence label="Merchant-name similarity" value={`${similarityScore}% semantic match`}/><Evidence label="Date intervals" value={s.members.slice(1,4).map((t,i)=>`${Math.round((new Date(`${t.date}T00:00:00`).getTime()-new Date(`${s.members[i].date}T00:00:00`).getTime())/86400000)} days`).join(" · ") || "Learning from timing"}/><Evidence label="Amount variance" value={`${currency(Math.min(...s.members.map(t=>t.amount)))} – ${currency(Math.max(...s.members.map(t=>t.amount)))}`}/><Evidence label="Recurrence confidence" value={`${s.confidence}% · ${s.frequency} cadence`}/></div>{s.status === "learning" ? <div className="drawer-classify"><strong>Classify this commitment</strong>{["Essential", "Shared expense", "Subscription", "Review later"].map(v=><button className={classification === v ? "selected" : ""} onClick={()=>setClassification(v)} key={v}>{classification === v && <Check size={14}/>} {v}</button>)}</div> : <div className="drawer-actions"><button className="secondary-btn" onClick={()=>onKeep(s.id)}>Keep it</button><button className="primary-btn" onClick={onClose}>{s.status === "active" ? "Looks right" : "Cancel / review"}</button></div>}</> : <><div className="drawer-summary"><span className="merchant-icon danger big"><AlertTriangle size={20}/></span><div><strong>{currency(a!.transaction.amount)}</strong><p>{a!.score}/100 anomaly score</p></div></div><p className="drawer-copy">This looks unusual, but we don’t assume it’s a mistake. It was kept separate from your recurring charges because no recurring pattern was found.</p><div className="evidence"><Evidence label="Category baseline" value={`${currency(a!.categoryMedian)} typical ${a!.transaction.category.toLowerCase()} transaction`}/><Evidence label="Amount deviation" value={a!.reasons[0]}/><Evidence label="Merchant novelty" value={a!.merchantNovelty ? "First time seen in your history" : "Known merchant"}/><Evidence label="Recurring cluster" value="No high-confidence match"/></div><div className="drawer-actions"><button className="secondary-btn" onClick={onClose}>Mark as expected</button><button className="primary-btn" onClick={onClose}>Review transaction</button></div></>}</aside></div>;
}

function Evidence({ label, value }: {label:string;value:string}) { return <div><span>{label}</span><strong>{value}</strong></div>; }
