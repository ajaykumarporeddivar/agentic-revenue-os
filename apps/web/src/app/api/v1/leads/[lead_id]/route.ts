import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ lead_id: string }> }) {
  const { lead_id } = await params;
  const tenantId = getTenantId();
  const body = await req.json();

  const updated = await db.update(schema.leads)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(schema.leads.id, lead_id))
    .returning();

  if (!updated.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ data: updated[0] });
}
