import { ulid } from "ulid";
import type { AgentEvent } from "./types.js";

type EventHandler = (event: AgentEvent) => Promise<void>;

const handlers = new Map<string, Set<EventHandler>>();

export function onEvent(eventType: string, handler: EventHandler): void {
  if (!handlers.has(eventType)) {
    handlers.set(eventType, new Set());
  }
  handlers.get(eventType)!.add(handler);
}

export function offEvent(eventType: string, handler: EventHandler): void {
  handlers.get(eventType)?.delete(handler);
}

export async function emitEvent(event: Omit<AgentEvent, "event_id" | "occurred_at" | "schema_version">): Promise<void> {
  const envelope: AgentEvent = {
    ...event,
    event_id: ulid(),
    schema_version: "1.0.0",
    occurred_at: new Date().toISOString(),
  };

  const typeHandlers = handlers.get(event.event_type);
  if (!typeHandlers) return;

  const promises = Array.from(typeHandlers).map(h =>
    h(envelope).catch(err => {
      console.error(`[EventBus] handler failed for ${event.event_type}:`, err);
    }),
  );
  await Promise.all(promises);
}

export async function emitAndWait(event: Omit<AgentEvent, "event_id" | "occurred_at" | "schema_version">): Promise<void> {
  const envelope: AgentEvent = {
    ...event,
    event_id: ulid(),
    schema_version: "1.0.0",
    occurred_at: new Date().toISOString(),
  };

  const typeHandlers = handlers.get(event.event_type);
  if (!typeHandlers) return;

  for (const h of typeHandlers) {
    await h(envelope);
  }
}

export function clearHandlers(): void {
  handlers.clear();
}
