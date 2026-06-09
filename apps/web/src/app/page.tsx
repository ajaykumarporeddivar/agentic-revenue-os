"use client";

import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Agentic Revenue OS</h1>
      <p style={{ color: "#555", marginBottom: 32, fontSize: 16, lineHeight: 1.5 }}>
        Discover validated commercial pain, generate offers, outreach, and proposals, and track revenue — all through governed AI agents.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <DashboardLink href="/intake" label="Business Intake" desc="Set up your company profile and target market" />
        <DashboardLink href="/opportunities" label="Opportunities" desc="View scored pain candidates and approve offers" />
        <DashboardLink href="/offers" label="Offers" desc="Review and approve generated offers" />
        <DashboardLink href="/outreach" label="Outreach" desc="Email and LinkedIn sequences" />
        <DashboardLink href="/proposals" label="Proposals" desc="Sales proposals for qualified leads" />
        <DashboardLink href="/deals" label="Deals" desc="Pipeline and deal tracking" />
        <DashboardLink href="/approvals" label="Approval Queue" desc="Review and approve agent outputs" />
        <DashboardLink href="/api/v1/revenue" label="Revenue Dashboard" desc="MRR, ARR, pipeline, and closed revenue" />
      </div>
    </main>
  );
}

function DashboardLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{
        padding: "16px 20px",
        background: "white",
        border: "1px solid #e0e0d8",
        borderRadius: 8,
        cursor: "pointer",
        transition: "box-shadow 0.15s",
      }}
        onMouseOver={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)")}
        onMouseOut={e => (e.currentTarget.style.boxShadow = "none")}
      >
        <div style={{ fontWeight: 500, marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 14, color: "#666" }}>{desc}</div>
      </div>
    </Link>
  );
}
