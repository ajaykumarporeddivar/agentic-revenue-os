import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@agentic/logger";
import { requireSession } from "./session";

const logger = createLogger({ service: "web" });

export function apiHandler(handler: (req: NextRequest, ctx: { tenantId: string; userId: string }) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      const session = requireSession();
      const response = await handler(req, { tenantId: session.tenantId, userId: session.userId });
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Internal server error";
      const status = msg.includes("Authentication") ? 401
        : msg.includes("cannot perform") ? 403
        : msg.includes("not found") ? 404
        : 500;
      logger.error("api.error", msg, { route: req.nextUrl.pathname, status });
      return NextResponse.json({ error: msg }, { status });
    }
  };
}

export function mapSnakeToCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}
