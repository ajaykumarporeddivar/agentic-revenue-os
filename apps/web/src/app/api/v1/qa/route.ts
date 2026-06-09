import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { enqueueJob } from "@agentic/jobs";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = await req.json();

  const review = await db.insert(schema.qaReviews)
    .values({
      tenantId,
      artifactType: body.artifact_type,
      artifactId: body.artifact_id,
      verdict: "pending",
      score: "0",
      checks: JSON.parse(JSON.stringify({})),
      approvedForFounderReview: false,
      approvedForSending: false,
    })
    .returning();

  await enqueueJob("qa-jobs", "qa.review", {
    tenantId,
    entityId: review[0].id,
    requestedByUserId: tenantId,
  });

  return NextResponse.json({ data: review[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.qaReviews)
    .where(eq(schema.qaReviews.tenantId, tenantId))
    .orderBy(schema.qaReviews.createdAt);
  return NextResponse.json({ data: all });
}
