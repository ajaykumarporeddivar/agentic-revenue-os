import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = await req.json();

  const lead = await db.insert(schema.leads)
    .values({
      tenantId,
      companyName: body.company_name,
      buyerName: body.buyer_name || null,
      buyerRole: body.buyer_role || null,
      email: body.email || null,
      linkedinUrl: body.linkedin_url || null,
      knownPain: body.known_pain || null,
      knownTools: JSON.parse(JSON.stringify(body.known_tools || [])),
      notes: body.notes || null,
    })
    .returning();

  return NextResponse.json({ data: lead[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.leads)
    .where(eq(schema.leads.tenantId, tenantId))
    .orderBy(schema.leads.createdAt);
  return NextResponse.json({ data: all });
}
