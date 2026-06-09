import { NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq, sql } from "drizzle-orm";
import { getTenantId } from "../../../../lib/session";

export async function GET() {
  const tenantId = getTenantId();

  const deals = await db.select().from(schema.deals)
    .where(eq(schema.deals.tenantId, tenantId));

  const openDeals = deals.filter(d => d.status === "open");
  const wonDeals = deals.filter(d => d.status === "won");

  const pipelineCents = openDeals.reduce((sum, d) => sum + d.valueCents, 0);
  const closedWonCents = wonDeals.reduce((sum, d) => sum + d.valueCents, 0);
  const mrrCents = Math.round(closedWonCents / 12);
  const arrCents = closedWonCents;

  const metrics = {
    period: new Date().toISOString().slice(0, 7),
    mrr_cents: mrrCents,
    arr_cents: arrCents,
    pipeline_cents: pipelineCents,
    closed_won_cents: closedWonCents,
    deals_count: deals.length,
    won_count: wonDeals.length,
    open_count: openDeals.length,
  };

  return NextResponse.json({ data: metrics });
}
