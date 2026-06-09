import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = await req.json();

  const deal = await db.insert(schema.deals)
    .values({
      tenantId,
      leadId: body.lead_id || null,
      offerId: body.offer_id || null,
      stage: "lead",
      valueCents: body.value_cents || 0,
      currency: body.currency || "usd",
      probability: body.probability || 0,
    })
    .returning();

  return NextResponse.json({ data: deal[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.deals)
    .where(eq(schema.deals.tenantId, tenantId))
    .orderBy(schema.deals.createdAt);
  return NextResponse.json({ data: all });
}
