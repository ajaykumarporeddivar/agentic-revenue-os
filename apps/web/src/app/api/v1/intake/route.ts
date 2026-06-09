import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { IntakeRequestSchema } from "@agentic/schemas";
import { createLogger } from "@agentic/logger";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

const log = createLogger({ service: "web" });

type ProfileInput = typeof schema.businessProfiles.$inferInsert;

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const body = IntakeRequestSchema.parse(await req.json());
  const values: ProfileInput = {
    companyName: body.company_name,
    industry: body.industry,
    targetCustomer: body.target_customer,
    geography: body.geography,
    currentOffer: body.current_offer ?? null,
    priceRange: body.price_range ?? null,
    deliveryCapabilities: body.delivery_capabilities as unknown as string[],
    excludedMarkets: body.excluded_markets as unknown as string[],
    riskConstraints: body.risk_constraints as unknown as string[],
    tenantId,
  };

  const existing = await db.select().from(schema.businessProfiles)
    .where(eq(schema.businessProfiles.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) {
    const updated = await db.update(schema.businessProfiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(schema.businessProfiles.tenantId, tenantId))
      .returning();
    log.info("api.request", "Business profile updated", { tenantId });
    return NextResponse.json({ data: updated[0] });
  }

  const created = await db.insert(schema.businessProfiles)
    .values(values)
    .returning();
  log.info("api.request", "Business profile created", { tenantId });
  return NextResponse.json({ data: created[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const profile = await db.select().from(schema.businessProfiles)
    .where(eq(schema.businessProfiles.tenantId, tenantId))
    .limit(1);
  if (!profile.length) return NextResponse.json({ error: "No profile found" }, { status: 404 });
  return NextResponse.json({ data: profile[0] });
}
