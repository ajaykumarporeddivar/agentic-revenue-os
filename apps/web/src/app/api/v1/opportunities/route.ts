import { NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../lib/session";

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.opportunities)
    .where(eq(schema.opportunities.tenantId, tenantId))
    .orderBy(schema.opportunities.createdAt);
  return NextResponse.json({ data: all });
}
