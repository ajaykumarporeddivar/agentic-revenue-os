import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { enqueueJob } from "@agentic/jobs";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = await req.json();

  const seq = await db.insert(schema.outreachSequences)
    .values({
      tenantId,
      offerId: body.offer_id,
      channels: JSON.parse(JSON.stringify(body.channels || ["email"])),
    })
    .returning();

  await enqueueJob("agent-jobs", "outreach.write", {
    tenantId,
    entityId: seq[0].id,
    requestedByUserId: tenantId,
  });

  return NextResponse.json({ data: seq[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.outreachSequences)
    .where(eq(schema.outreachSequences.tenantId, tenantId))
    .orderBy(schema.outreachSequences.createdAt);
  return NextResponse.json({ data: all });
}
