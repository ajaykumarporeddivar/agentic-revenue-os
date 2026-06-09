import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { assertCan } from "@agentic/auth";
import { getTenantId } from "../../../../../lib/session";
import { requireSession } from "../../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest, { params }: { params: Promise<{ artifact_id: string }> }) {
  const { artifact_id } = await params;
  const tenantId = getTenantId();
  const session = requireSession();
  assertCan(session.role, "artifact:approve");

  const body = await req.json();

  const approval = await db.insert(schema.approvals)
    .values({
      tenantId,
      artifactType: body.artifact_type,
      artifactId: artifact_id,
      userId: session.userId,
      decision: body.decision,
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json({ data: approval[0] }, { status: 201 });
}
