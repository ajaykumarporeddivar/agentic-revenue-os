import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@agentic/database";
import { createLogger } from "@agentic/logger";

const log = createLogger({ service: "web" });

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get("stripe-signature");
    const body = await req.text();
    const payload = JSON.parse(body);

    const eventType = payload.type;
    const data = payload.data?.object;

    log.info("stripe.webhook", `Received ${eventType}`, { id: data?.id });

    // Handle payment_intent.succeeded
    if (eventType === "payment_intent.succeeded") {
      const tenantId = data?.metadata?.tenant_id;
      if (tenantId) {
        const amountCents = data.amount_received || 0;
        // Record revenue event
        await db.insert(schema.auditEvents).values({
          tenantId,
          actorType: "system",
          actorId: "stripe",
          eventType: "payment.received",
          entityType: "payment",
          payload: { amount_cents: amountCents, stripe_event_id: data.id },
        });
      }
    }

    // Handle checkout.session.completed
    if (eventType === "checkout.session.completed") {
      const tenantId = data?.metadata?.tenant_id;
      if (tenantId && data?.mode === "payment") {
        // Could auto-create a deal from a checkout
        log.info("stripe.webhook", "Checkout completed", { tenantId, amount: data.amount_total });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("stripe.webhook", "Webhook handling failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
    return NextResponse.json({ error: "Webhook error" }, { status: 400 });
  }
}
