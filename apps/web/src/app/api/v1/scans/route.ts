import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { ScanConfigSchema } from "@agentic/schemas";
import { enqueueJob } from "@agentic/jobs";
import { createLogger } from "@agentic/logger";
import { getTenantId } from "../../../../lib/session";
import { eq } from "drizzle-orm";

const log = createLogger({ service: "web" });

export async function POST(req: NextRequest) {
  const tenantId = getTenantId();
  const config = ScanConfigSchema.parse(await req.json());

  const scan = await db.insert(schema.scans)
    .values({
      tenantId,
      keywords: JSON.parse(JSON.stringify(config.keywords)),
      sources: JSON.parse(JSON.stringify(config.sources)),
      maxResultsPerSource: config.max_results_per_source,
    })
    .returning();

  await enqueueJob("agent-jobs", "scan.market", {
    tenantId,
    entityId: scan[0].id,
    requestedByUserId: tenantId,
  });

  log.info("api.request", "Scan created", { tenantId, scanId: scan[0].id });
  return NextResponse.json({ data: scan[0] }, { status: 201 });
}

export async function GET() {
  const tenantId = getTenantId();
  const all = await db.select().from(schema.scans)
    .where(eq(schema.scans.tenantId, tenantId))
    .orderBy(schema.scans.createdAt);
  return NextResponse.json({ data: all });
}
