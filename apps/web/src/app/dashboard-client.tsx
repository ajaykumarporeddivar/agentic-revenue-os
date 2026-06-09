"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Mode = "intake" | "opportunities" | "offers" | "outreach" | "proposals" | "deals" | "approvals";

const nav = [
  ["intake", "Intake"],
  ["opportunities", "Opportunities"],
  ["offers", "Offers"],
  ["outreach", "Outreach"],
  ["proposals", "Proposals"],
  ["deals", "Deals"],
  ["approvals", "Approvals"],
] as const;

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "10px 12px",
  border: "1px solid #d7d7cc",
  borderRadius: 8,
  fontSize: 14,
  background: "#fff",
};

const buttonStyle = {
  border: 0,
  borderRadius: 8,
  background: "#1d4ed8",
  color: "#fff",
  padding: "10px 14px",
  fontWeight: 650,
  cursor: "pointer",
};

export function DashboardScreen({ mode }: { mode: Mode }) {
  const [items, setItems] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const endpoint = useMemo(() => {
    if (mode === "approvals") return "/api/v1/approvals";
    return `/api/v1/${mode}`;
  }, [mode]);

  async function load() {
    setMessage("");
    try {
      const res = await fetch(endpoint);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setItems(Array.isArray(json.data) ? json.data : json.data ? [json.data] : []);
    } catch (err) {
      setItems([]);
      setMessage(err instanceof Error ? err.message : "Unable to load data");
    }

    try {
      const res = await fetch("/api/v1/revenue");
      const json = await res.json();
      if (res.ok) setRevenue(json.data);
    } catch {}
  }

  useEffect(() => {
    load();
  }, [endpoint]);

  async function submit(path: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setMessage("Saved. Background AI jobs may take a minute to finish.");
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "28px 20px 56px" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 22 }}>
        <div>
          <Link href="/" style={{ color: "#555", textDecoration: "none", fontSize: 13 }}>Agentic Revenue OS</Link>
          <h1 style={{ fontSize: 28, margin: "6px 0 0", textTransform: "capitalize" }}>{mode}</h1>
        </div>
        <button onClick={load} disabled={busy} style={{ ...buttonStyle, background: "#111827" }}>Refresh</button>
      </header>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {nav.map(([href, label]) => (
          <Link key={href} href={`/${href}`} style={{
            color: href === mode ? "#fff" : "#1f2937",
            background: href === mode ? "#111827" : "#fff",
            border: "1px solid #ddd",
            padding: "8px 10px",
            borderRadius: 8,
            textDecoration: "none",
            fontSize: 14,
          }}>{label}</Link>
        ))}
      </nav>

      {revenue && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 22 }}>
          <Metric label="Pipeline" value={money(revenue.pipeline_cents)} />
          <Metric label="Closed Won" value={money(revenue.closed_won_cents)} />
          <Metric label="Deals" value={String(revenue.deals_count ?? 0)} />
          <Metric label="Won" value={String(revenue.won_count ?? 0)} />
        </section>
      )}

      {message && (
        <div style={{ padding: 12, border: "1px solid #d7d7cc", background: "#fff", borderRadius: 8, marginBottom: 16 }}>
          {message}
        </div>
      )}

      {mode === "intake" && <IntakeForm busy={busy} submit={submit} />}
      {mode === "opportunities" && <ScanForm busy={busy} submit={submit} />}
      {mode === "offers" && <GenerateForm busy={busy} submit={submit} path="/api/v1/offers" field="opportunity_id" label="Opportunity ID" />}
      {mode === "outreach" && <GenerateForm busy={busy} submit={submit} path="/api/v1/outreach" field="offer_id" label="Offer ID" extra={{ channels: ["email", "linkedin"] }} />}
      {mode === "proposals" && <GenerateForm busy={busy} submit={submit} path="/api/v1/proposals" field="offer_id" label="Offer ID" />}
      {mode === "deals" && <DealForm busy={busy} submit={submit} />}

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, marginBottom: 10 }}>Records</h2>
        <div style={{ display: "grid", gap: 10 }}>
          {items.length === 0 ? (
            <div style={{ padding: 18, background: "#fff", border: "1px solid #e0e0d8", borderRadius: 8 }}>
              No records yet. Create one above or run the previous workflow step.
            </div>
          ) : items.map((item) => <RecordCard key={item.id ?? JSON.stringify(item).slice(0, 24)} item={item} />)}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 14, background: "#fff", border: "1px solid #e0e0d8", borderRadius: 8 }}>
      <div style={{ color: "#666", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 750 }}>{value}</div>
    </div>
  );
}

function IntakeForm({ busy, submit }: { busy: boolean; submit: (path: string, payload: Record<string, unknown>) => Promise<void> }) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit("/api/v1/intake", {
      company_name: data.get("company_name"),
      industry: data.get("industry"),
      target_customer: data.get("target_customer"),
      geography: data.get("geography"),
      current_offer: data.get("current_offer"),
      price_range: data.get("price_range"),
      delivery_capabilities: split(data.get("delivery_capabilities")),
      excluded_markets: split(data.get("excluded_markets")),
      risk_constraints: split(data.get("risk_constraints")),
    });
  }
  return (
    <FormShell onSubmit={onSubmit}>
      <Field name="company_name" label="Company" value="Acme AI Systems" />
      <Field name="industry" label="Industry" value="B2B service automation" />
      <Field name="target_customer" label="Target Customer" value="Recruitment agencies with 5-50 employees" />
      <Field name="geography" label="Geography" value="US and UK" />
      <Field name="current_offer" label="Current Offer" value="AI workflow automation" />
      <Field name="price_range" label="Price Range" value="$1,500-$5,000 setup plus monthly support" />
      <Field name="delivery_capabilities" label="Capabilities" value="CRM automation, AI workflow design, outreach systems" />
      <Field name="excluded_markets" label="Excluded Markets" value="regulated financial advice, clinical healthcare" />
      <Field name="risk_constraints" label="Risk Constraints" value="no unsupported ROI claims, founder approval before sending" />
      <button disabled={busy} style={buttonStyle}>Save profile</button>
    </FormShell>
  );
}

function ScanForm({ busy, submit }: { busy: boolean; submit: (path: string, payload: Record<string, unknown>) => Promise<void> }) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit("/api/v1/scans", {
      keywords: split(data.get("keywords")),
      sources: ["web_search", "job_posts", "forums", "reviews"],
      max_results_per_source: Number(data.get("max_results_per_source") || 5),
      time_window_days: 365,
    });
  }
  return (
    <FormShell onSubmit={onSubmit}>
      <Field name="keywords" label="Scan Keywords" value="candidate follow-up, recruitment CRM admin, recruiter manual work" />
      <Field name="max_results_per_source" label="Max Results Per Source" value="5" />
      <button disabled={busy} style={buttonStyle}>Run market scan</button>
    </FormShell>
  );
}

function GenerateForm({ busy, submit, path, field, label, extra = {} }: {
  busy: boolean;
  submit: (path: string, payload: Record<string, unknown>) => Promise<void>;
  path: string;
  field: string;
  label: string;
  extra?: Record<string, unknown>;
}) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit(path, { [field]: data.get(field), ...extra });
  }
  return (
    <FormShell onSubmit={onSubmit}>
      <Field name={field} label={label} value="" />
      <button disabled={busy} style={buttonStyle}>Generate</button>
    </FormShell>
  );
}

function DealForm({ busy, submit }: { busy: boolean; submit: (path: string, payload: Record<string, unknown>) => Promise<void> }) {
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await submit("/api/v1/deals", {
      value_cents: Math.round(Number(data.get("value") || 0) * 100),
      currency: "usd",
      probability: Number(data.get("probability") || 25),
    });
  }
  return (
    <FormShell onSubmit={onSubmit}>
      <Field name="value" label="Deal Value USD" value="2500" />
      <Field name="probability" label="Probability" value="25" />
      <button disabled={busy} style={buttonStyle}>Create deal</button>
    </FormShell>
  );
}

function FormShell({ children, onSubmit }: { children: React.ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form onSubmit={onSubmit} style={{
      display: "grid",
      gap: 12,
      background: "#fff",
      border: "1px solid #e0e0d8",
      borderRadius: 8,
      padding: 16,
    }}>
      {children}
    </form>
  );
}

function Field({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 13, color: "#444" }}>
      {label}
      <input name={name} defaultValue={value} style={fieldStyle} />
    </label>
  );
}

function RecordCard({ item }: { item: any }) {
  const title = item.name || item.title || item.painStatement || item.buyer || item.companyName || item.id || "Record";
  return (
    <article style={{ padding: 16, background: "#fff", border: "1px solid #e0e0d8", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <strong style={{ overflowWrap: "anywhere" }}>{title}</strong>
        {item.status && <span style={{ color: "#555", fontSize: 12 }}>{item.status}</span>}
      </div>
      <pre style={{
        margin: 0,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        color: "#555",
        fontSize: 12,
        lineHeight: 1.5,
      }}>{JSON.stringify(item, null, 2)}</pre>
    </article>
  );
}

function split(value: FormDataEntryValue | null): string[] {
  return String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function money(cents: number | undefined) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format((cents || 0) / 100);
}
