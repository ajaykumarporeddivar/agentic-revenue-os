import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { enqueueJob } from "@agentic/jobs";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = await req.json();

  const prop = await db.insert(schema.proposals)
    .values({
      tenantId,
      offerId: body.offer_id,
      leadId: body.lead_id || null,
      status: "draft",
      title: "",
      executiveSummary: "",
      problem: "",
      recommendedSolution: "",
      scope: JSON.parse(JSON.stringify({ included: [], excluded: [] })),
      pricing: JSON.parse(JSON.stringify({ setup_fee: "", monthly_support: "" })),
      nextStep: "",
    })
    .returning();

  let queueStatus = "queued";
  try {
    await enqueueJob("agent-jobs", "proposal.write", {
      tenantId,
      entityId: prop[0].id,
      requestedByUserId: tenantId,
    });
  } catch {
    queueStatus = "queue_unavailable";
  }

  return NextResponse.json({ data: { ...prop[0], queueStatus } }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.proposals)
    .where(eq(schema.proposals.tenantId, tenantId))
    .orderBy(schema.proposals.createdAt);
  return NextResponse.json({ data: all });
}
