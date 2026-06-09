import { z } from "zod";

// ─── Memory Tiers ──────────────────────────────────────────────────
export enum MemoryTier {
  M0 = "M0",  // Ephemeral / in-memory only
  M1 = "M1",  // Workflow-scoped (current scan, current offer)
  M2 = "M2",  // Tenant-scoped (business profile, signals)
  M3 = "M3",  // Cross-tenant aggregate (market trends)
  M4 = "M4",  // System (deployments, audit, billing)
  M5 = "M5",  // Meta (evaluations, benchmarks, agent registry)
}

// ─── Agent Classes ────────────────────────────────────────────────
export type AgentClass =
  | "intelligence"
  | "strategy"
  | "deliberation"
  | "product"
  | "planning"
  | "execution"
  | "validation"
  | "deployment"
  | "revenue"
  | "governance"
  | "operations"
  | "self_improvement";

// ─── Retry Policy ─────────────────────────────────────────────────
export type RetryPolicy =
  | { max_attempts: number; backoff: "none" | "linear" | "exponential" }
  | { max_attempts: 1; backoff: "none" };

// ─── Fallback, Validation, Escalation ─────────────────────────────
export const FallbackPolicy = z.enum([
  "partial_source_success_allowed",
  "send_to_human_review",
  "mark_low_confidence",
  "require_human_estimate",
  "route_to_founder",
  "human_spec_review",
  "serial_task_plan",
  "split_task_and_retry",
  "escalate_with_failure_report",
  "rollback",
  "draft_only_no_send",
  "human_sales_review",
  "human_cs_review",
  "finance_audit_queue",
  "deny_by_default",
  "alert_human_operator",
  "no_change",
]);
export type FallbackPolicy = z.infer<typeof FallbackPolicy>;

export const ValidationPolicy = z.enum([
  "require_source_url_or_trace",
  "each_pain_requires_evidence_buyer_and_current_workaround",
  "require_raw_scores_confidence_and_evidence_links",
  "require_revenue_cost_probability_and_risk",
  "require_minority_risks",
  "require_user_acceptance_criteria_metrics_and_revenue_path",
  "no_cycles_all_dependencies_resolved",
  "artifact_manifest_required",
  "pass_fail_score_and_repair_log_required",
  "deployment_url_healthcheck_required",
  "consent_suppression_and_claims_check_required",
  "proposal_requires_scope_price_terms_and_risk",
  "churn_risk_and_next_action_required",
  "ledger_balances_required",
  "decision_reason_required",
  "severity_owner_and_runbook_required",
  "benchmark_delta_and_regression_report_required",
]);
export type ValidationPolicy = z.infer<typeof ValidationPolicy>;

export const EscalationPolicy = z.enum([
  "p2_if_all_sources_fail",
  "p2_if_zero_candidates",
  "p1_if_high_score_low_confidence",
  "p0_if_blast_radius_critical",
  "p1_if_no_consensus",
  "p1_if_spec_incomplete_after_repair",
  "p1_if_invalid_dag",
  "p1_if_build_blocked",
  "p1_if_repair_fails",
  "p0_if_deploy_fails_after_partial_release",
  "p0_if_compliance_violation",
  "p1_if_discount_or_contract_exception",
  "p1_if_churn_risk_high",
  "p0_if_billing_data_loss",
  "p0_if_security_or_privacy_violation",
  "p0_for_security_or_revenue_outage",
  "p1_if_agent_class_degraded",
]);
export type EscalationPolicy = z.infer<typeof EscalationPolicy>;

// ─── Full Agent Contract (15 fields) ──────────────────────────────
export interface AgentContract {
  agent_name: string;
  agent_class: AgentClass;
  version: string;
  capabilities: string[];
  input_schema: string;
  output_schema: string;
  memory_read_tiers: MemoryTier[];
  memory_write_tiers: MemoryTier[];
  allowed_tools: string[];
  cost_ceiling_usd: number;
  timeout_ms: number;
  retry_policy: RetryPolicy;
  fallback_policy: FallbackPolicy;
  validation_policy: ValidationPolicy;
  escalation_policy: EscalationPolicy;
}

// ─── Governor Context ─────────────────────────────────────────────
export interface GovContext {
  tenantId: string;
  workflowId: string;
  correlationId: string;
  causationId?: string;
  actor: { type: "user" | "agent" | "system"; id: string };
  data: Record<string, unknown>;
}

// ─── Event Bus ────────────────────────────────────────────────────
export interface AgentEvent {
  event_id: string;
  event_type: string;
  schema_version: string;
  tenant_id: string;
  workflow_id?: string;
  run_id?: string;
  correlation_id: string;
  causation_id?: string;
  actor: { type: "user" | "agent" | "system"; id: string };
  payload: Record<string, unknown>;
  occurred_at: string;
  trace_id?: string;
}

// ─── Tool Definitions ─────────────────────────────────────────────
export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
}

// ─── Runner ───────────────────────────────────────────────────────
export interface AgentRunResult {
  success: boolean;
  output: Record<string, unknown> | null;
  confidence: number;
  cost_cents: number;
  duration_ms: number;
  failure_reason?: string;
  fallback_used?: boolean;
  escalated?: boolean;
}

export interface AgentRunInput {
  agent_name: string;
  tenantId: string;
  workflowId: string;
  correlationId: string;
  causationId?: string;
  actor: { type: "user" | "agent" | "system"; id: string };
  input: Record<string, unknown>;
  contract: AgentContract;
}
