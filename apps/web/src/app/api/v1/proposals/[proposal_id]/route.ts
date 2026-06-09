import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ proposal_id: string }> }) {
  const { proposal_id } = await params;
  const tenantId = getTenantId();
  const prop = await db.select().from(schema.proposals)
    .where(eq(schema.proposals.id, proposal_id))
    .limit(1);
  if (!prop.length || prop[0].tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: prop[0] });
}
