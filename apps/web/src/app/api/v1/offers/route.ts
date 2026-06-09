import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { enqueueJob } from "@agentic/jobs";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = await req.json();

  const offer = await db.insert(schema.offers)
    .values({
      tenantId,
      opportunityId: body.opportunity_id,
      status: "draft",
      name: body.name || "Untitled Offer",
      oneSentencePitch: "",
      targetCustomer: "",
      painAddressed: "",
      deliverables: "[]",
      scope: JSON.parse(JSON.stringify({ included: [], excluded: [] })),
      timeline: "",
      pricing: JSON.parse(JSON.stringify({ setup_fee: "", monthly_support: "" })),
      proofPlan: JSON.parse(JSON.stringify({ baseline_metric: "", target_metric: "", measurement_window: "" })),
    })
    .returning();

  await enqueueJob("agent-jobs", "offer.design", {
    tenantId,
    entityId: offer[0].id,
    requestedByUserId: tenantId,
  });

  return NextResponse.json({ data: offer[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.offers)
    .where(eq(schema.offers.tenantId, tenantId))
    .orderBy(schema.offers.createdAt);
  return NextResponse.json({ data: all });
}
