import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ deal_id: string }> }) {
  const { deal_id } = await params;
  const tenantId = getTenantId();
  const body = await req.json();

  const updateData: Record<string, unknown> = { ...body, updatedAt: new Date() };
  if (body.stage === "won") updateData.wonAt = new Date();
  if (body.stage === "lost") updateData.lostAt = new Date();

  const updated = await db.update(schema.deals)
    .set(updateData)
    .where(eq(schema.deals.id, deal_id))
    .returning();

  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated[0] });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ deal_id: string }> }) {
  const { deal_id } = await params;
  const tenantId = getTenantId();
  const deal = await db.select().from(schema.deals)
    .where(eq(schema.deals.id, deal_id))
    .limit(1);
  if (!deal.length || deal[0].tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: deal[0] });
}
