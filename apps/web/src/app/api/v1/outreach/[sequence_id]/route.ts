import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ sequence_id: string }> }) {
  const { sequence_id } = await params;
  const tenantId = getTenantId();
  const seq = await db.select().from(schema.outreachSequences)
    .where(eq(schema.outreachSequences.id, sequence_id))
    .limit(1);
  if (!seq.length || seq[0].tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: seq[0] });
}
