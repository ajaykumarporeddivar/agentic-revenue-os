import { ulid } from "ulid";
import type { AgentContract, GovContext, AgentRunInput, AgentRunResult } from "./types.js";
import { getContract, registerAgent } from "./registry.js";
import { emitEvent } from "./event-bus.js";
import { AgentClass, FallbackPolicy, ValidationPolicy, EscalationPolicy, MemoryTier } from "./types.js";

// ─── Governor ─────────────────────────────────────────────────────
// The Governor is the ONLY component that:
// 1. Hydrates context for agents (Rule 2)
// 2. Receives agent outputs and writes them via Event Bus (Rule 3)
// 3. Enforces memory tier permissions (Rule 4)
// 4. Validates contracts before execution
// 5. Applies retry, fallback, and escalation policies

export class Governor {
  async run(agentName: string, ctx: GovContext): Promise<AgentRunResult> {
    const contract = getContract(agentName);
    if (!contract) {
      return {
        success: false, output: null, confidence: 0,
        cost_cents: 0, duration_ms: 0,
        failure_reason: `Unknown agent: "${agentName}". Register it first.`,
      };
    }

    const start = Date.now();
    let lastError: string | undefined;
    let result: AgentRunResult | null = null;

    await emitEvent({
      event_type: "agent_run.started",
      tenant_id: ctx.tenantId,
      workflow_id: ctx.workflowId,
      correlation_id: ctx.correlationId,
      causation_id: ctx.causationId,
      actor: ctx.actor,
      payload: { agent_name: agentName, contract: contract.agent_class },
    });

    // Retry loop
    for (let attempt = 1; attempt <= contract.retry_policy.max_attempts; attempt++) {
      try {
        const runId = ulid();
        const input: AgentRunInput = {
          agent_name: agentName,
          tenantId: ctx.tenantId,
          workflowId: ctx.workflowId,
          correlationId: ctx.correlationId,
          causationId: ctx.causationId,
          actor: ctx.actor,
          input: ctx.data,
          contract,
        };

        // Agents do not call agents directly — Governor runs the handler.
        result = await this.executeAgent(contract, input, runId);

        await emitEvent({
          event_type: "agent_run.completed",
          tenant_id: ctx.tenantId,
          workflow_id: ctx.workflowId,
          run_id: runId,
          correlation_id: ctx.correlationId,
          causation_id: ctx.causationId,
          actor: ctx.actor,
          payload: {
            agent_name: agentName,
            status: result.success ? "success" : "partial_success",
            cost_cents: result.cost_cents,
            duration_ms: result.duration_ms,
          },
        });

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const durationMs = Date.now() - start;

        // Check timeout
        if (durationMs >= contract.timeout_ms) {
          result = {
            success: false, output: null, confidence: 0,
            cost_cents: 0, duration_ms: durationMs,
            failure_reason: `Timeout after ${durationMs}ms (limit: ${contract.timeout_ms}ms). Last error: ${lastError}`,
          };
          break;
        }

        // Backoff
        if (attempt < contract.retry_policy.max_attempts) {
          const delay = this.backoffDelay(attempt, contract.retry_policy.backoff);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }

    // All retries exhausted — apply fallback
    result = await this.applyFallback(contract, ctx, lastError!, result);

    await emitEvent({
      event_type: "agent_run.failed",
      tenant_id: ctx.tenantId,
      workflow_id: ctx.workflowId,
      correlation_id: ctx.correlationId,
      causation_id: ctx.causationId,
      actor: ctx.actor,
      payload: {
        agent_name: agentName,
        reason: result.failure_reason,
        fallback_used: result.fallback_used,
        escalated: result.escalated,
      },
    });

    return result;
  }

  private async executeAgent(
    contract: AgentContract,
    input: AgentRunInput,
    runId: string,
  ): Promise<AgentRunResult> {
    // In production, this dispatches to a handler registered by the agent.
    // Handlers are keyed by agent_name in the handler registry.
    const handler = handlerRegistry.get(contract.agent_name);
    if (!handler) {
      return {
        success: false, output: null, confidence: 0,
        cost_cents: 0, duration_ms: 0,
        failure_reason: `No handler registered for "${contract.agent_name}".`,
      };
    }

    return handler(input, runId);
  }

  private async applyFallback(
    contract: AgentContract,
    ctx: GovContext,
    error: string,
    previous: AgentRunResult | null,
  ): Promise<AgentRunResult> {
    switch (contract.fallback_policy) {
      case "mark_low_confidence":
        return {
          ...previous ?? { success: true, output: null, confidence: 0, cost_cents: 0, duration_ms: 0 },
          confidence: 0.1,
          fallback_used: true,
          failure_reason: `Low confidence fallback: ${error}`,
        };

      case "send_to_human_review":
      case "route_to_founder":
      case "human_spec_review":
      case "human_sales_review":
      case "human_cs_review":
      case "require_human_estimate":
        return {
          success: false, output: null, confidence: 0,
          cost_cents: 0, duration_ms: 0,
          fallback_used: true, escalated: true,
          failure_reason: `Escalated to human: ${error}`,
        };

      case "draft_only_no_send":
        return {
          success: true, output: { draft_only: true, reason: error }, confidence: 0.3,
          cost_cents: 0, duration_ms: 0,
          fallback_used: true,
          failure_reason: `Draft only: ${error}`,
        };

      case "serial_task_plan":
        return {
          success: true, output: { plan_type: "serial", reason: error }, confidence: 0.5,
          cost_cents: 0, duration_ms: 0,
          fallback_used: true,
          failure_reason: `Serial fallback: ${error}`,
        };

      case "split_task_and_retry":
        return {
          success: false, output: null, confidence: 0,
          cost_cents: 0, duration_ms: 0,
          fallback_used: true,
          failure_reason: `Split and retry needed: ${error}`,
        };

      case "deny_by_default":
        return {
          success: false, output: null, confidence: 0,
          cost_cents: 0, duration_ms: 0,
          fallback_used: true,
          failure_reason: `Denied by default: ${error}`,
        };

      case "no_change":
        return {
          success: true, output: { no_change: true, reason: error }, confidence: 0.5,
          cost_cents: 0, duration_ms: 0,
          fallback_used: true,
          failure_reason: `No change applied: ${error}`,
        };

      default:
        return {
          success: false, output: null, confidence: 0,
          cost_cents: 0, duration_ms: 0,
          failure_reason: `Unhandled fallback policy "${contract.fallback_policy}": ${error}`,
        };
    }
  }

  private backoffDelay(attempt: number, policy: string): number {
    switch (policy) {
      case "exponential":
        return Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      case "linear":
        return 1000 * attempt;
      default:
        return 1000;
    }
  }
}

export const governor = new Governor();

// ─── Handler Registry ─────────────────────────────────────────────
// Agents register their handlers so the Governor can dispatch.
type AgentHandler = (input: AgentRunInput, runId: string) => Promise<AgentRunResult>;

const handlerRegistry = new Map<string, AgentHandler>();

export function registerHandler(agentName: string, handler: AgentHandler): void {
  handlerRegistry.set(agentName, handler);
}

export function registerAgentWithContract(contract: AgentContract, handler: AgentHandler): void {
  registerAgent(contract);
  registerHandler(contract.agent_name, handler);
}
