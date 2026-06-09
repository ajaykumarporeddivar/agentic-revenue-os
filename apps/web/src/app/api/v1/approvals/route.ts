import { NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../lib/session";

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.approvals)
    .where(eq(schema.approvals.tenantId, tenantId))
    .orderBy(schema.approvals.createdAt);
  return NextResponse.json({ data: all });
}
