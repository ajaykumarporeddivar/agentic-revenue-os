import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ opportunity_id: string }> }) {
  const { opportunity_id } = await params;
  const tenantId = getTenantId();
  const body = await req.json();

  const updated = await db.update(schema.opportunities)
    .set({ ...body, selectedAt: body.status === "selected" ? new Date() : undefined })
    .where(eq(schema.opportunities.id, opportunity_id))
    .returning();

  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated[0] });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ opportunity_id: string }> }) {
  const { opportunity_id } = await params;
  const tenantId = getTenantId();
  const opp = await db.select().from(schema.opportunities)
    .where(eq(schema.opportunities.id, opportunity_id))
    .limit(1);
  if (!opp.length || opp[0].tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: opp[0] });
}
