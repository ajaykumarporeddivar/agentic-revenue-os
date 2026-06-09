import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { eq } from "drizzle-orm";
import { getTenantId } from "../../../../../lib/session";

export async function GET(req: NextRequest, { params }: { params: Promise<{ scan_id: string }> }) {
  const { scan_id } = await params;
  const tenantId = getTenantId();

  const scan = await db.select().from(schema.scans)
    .where(eq(schema.scans.id, scan_id))
    .limit(1);

  if (!scan.length || scan[0].tenantId !== tenantId) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  const signals = await db.select().from(schema.signals)
    .where(eq(schema.signals.scanId, scan_id));

  return NextResponse.json({ data: { ...scan[0], signals } });
}
