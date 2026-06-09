import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ offer_id: string }> }) {
  const { offer_id } = await params;
  const tenantId = getTenantId();
  const offer = await db.select().from(schema.offers)
    .where(eq(schema.offers.id, offer_id))
    .limit(1);
  if (!offer.length || offer[0].tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: offer[0] });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ offer_id: string }> }) {
  const { offer_id } = await params;
  const tenantId = getTenantId();
  const body = await req.json();
  const updated = await db.update(schema.offers)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.offers.id, offer_id))
    .returning();
  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated[0] });
}
