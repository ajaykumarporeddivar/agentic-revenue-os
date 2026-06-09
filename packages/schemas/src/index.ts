import { z } from "zod";

export const TenantId = z.string().ulid();
export type TenantId = z.infer<typeof TenantId>;
export const WorkflowId = z.string().ulid();
export type WorkflowId = z.infer<typeof WorkflowId>;

// ─── Event Envelope ───────────────────────────────────────────────
export const ActorSchema = z.object({
  type: z.enum(["user", "agent", "system"]),
  id: z.string(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const EventEnvelopeSchema = z.object({
  event_id: z.string().ulid(),
  event_type: z.string(),
  schema_version: z.literal("1.0.0"),
  tenant_id: TenantId,
  workflow_id: WorkflowId.optional(),
  run_id: z.string().ulid().optional(),
  correlation_id: z.string().optional(),
  causation_id: z.string().optional(),
  actor: ActorSchema,
  payload: z.record(z.unknown()).default({}),
  occurred_at: z.string().datetime(),
  trace_id: z.string().optional(),
});
export type EventEnvelope = z.infer<typeof EventEnvelopeSchema>;

// ─── Business Profile / Intake ───────────────────────────────────
export const BusinessProfileSchema = z.object({
  company_name: z.string().min(1),
  industry: z.string().min(1),
  target_customer: z.string().min(1),
  geography: z.string().min(1),
  current_offer: z.string().optional(),
  price_range: z.string().optional(),
  delivery_capabilities: z.array(z.string()).default([]),
  excluded_markets: z.array(z.string()).default([]),
  risk_constraints: z.array(z.string()).default([]),
});
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;

export const IntakeRequestSchema = BusinessProfileSchema;
export type IntakeRequest = z.infer<typeof IntakeRequestSchema>;

// ─── Scan & Signal ────────────────────────────────────────────────
export const ScanConfigSchema = z.object({
  keywords: z.array(z.string()).min(1),
  sources: z.array(z.enum(["web_search", "job_posts", "forums", "reviews", "competitor_pages"])).min(1),
  max_results_per_source: z.number().int().min(1).max(50).default(10),
  time_window_days: z.number().int().default(365),
});
export type ScanConfig = z.infer<typeof ScanConfigSchema>;

export const SignalSchema = z.object({
  signal_id: z.string().ulid(),
  source_type: z.enum(["web_search", "job_post", "review", "forum", "competitor_page", "user_note"]),
  source_url: z.string().url().optional(),
  source_title: z.string().optional(),
  source_date: z.string().optional(),
  observed_problem: z.string().min(1),
  affected_actor: z.string().optional(),
  business_context: z.string().optional(),
  evidence_text: z.string().min(1),
  signal_strength: z.number().int().min(1).max(5),
  relevance_score: z.number().min(0).max(1),
});
export type Signal = z.infer<typeof SignalSchema>;

export const ScanResultSchema = z.object({
  scan_id: z.string().ulid(),
  signals: z.array(SignalSchema),
  scan_summary: z.object({
    total_signals: z.number().int(),
    strong_signals: z.number().int(),
    top_recurring_themes: z.array(z.string()),
  }),
});
export type ScanResult = z.infer<typeof ScanResultSchema>;

// ─── Pain Candidate ───────────────────────────────────────────────
export const BusinessImpactSchema = z.object({
  cost_type: z.enum(["labor_cost", "lost_revenue", "churn_risk", "speed_delay", "compliance_risk"]),
  impact_description: z.string(),
  measurable_proxy: z.string(),
});
export type BusinessImpact = z.infer<typeof BusinessImpactSchema>;

export const PainCandidateSchema = z.object({
  pain_id: z.string().ulid(),
  pain_statement: z.string().min(1),
  affected_buyer: z.string().min(1),
  affected_users: z.array(z.string()).default([]),
  current_workaround: z.string().min(1),
  business_impact: BusinessImpactSchema,
  evidence_signal_ids: z.array(z.string()).min(1),
  evidence_summary: z.string().min(1),
  target_customer_fit: z.number().min(0).max(1),
  pain_intensity: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});
export type PainCandidate = z.infer<typeof PainCandidateSchema>;

export const PainCandidateListSchema = z.object({
  pain_candidates: z.array(PainCandidateSchema).min(1),
});
export type PainCandidateList = z.infer<typeof PainCandidateListSchema>;

// ─── Opportunity Score ────────────────────────────────────────────
export const RiskSchema = z.object({
  risk: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
  mitigation: z.string().optional(),
});
export type Risk = z.infer<typeof RiskSchema>;

export const OpportunityScoreSchema = z.object({
  opportunity_id: z.string().ulid(),
  pain_id: z.string().ulid(),
  recommended: z.boolean(),
  score_total: z.number().int().min(0).max(100),
  score_breakdown: z.object({
    urgency: z.number().int().min(0).max(20),
    willingness_to_pay: z.number().int().min(0).max(20),
    ease_of_delivery: z.number().int().min(0).max(20),
    speed_to_revenue: z.number().int().min(0).max(20),
    competitive_gap: z.number().int().min(0).max(10),
    evidence_confidence: z.number().int().min(0).max(10),
  }),
  buyer: z.string().min(1),
  ideal_customer_profile: z.string().min(1),
  why_now: z.string().optional(),
  revenue_path: z.string().min(1),
  estimated_price_range: z.string().optional(),
  risks: z.array(RiskSchema).default([]),
  decision: z.enum(["pursue", "monitor", "reject"]),
  confidence: z.number().min(0).max(1),
});
export type OpportunityScore = z.infer<typeof OpportunityScoreSchema>;

// ─── Offer ────────────────────────────────────────────────────────
export const OfferSchema = z.object({
  offer_id: z.string().ulid(),
  name: z.string().min(1),
  one_sentence_pitch: z.string().min(1),
  target_customer: z.string().min(1),
  pain_addressed: z.string().min(1),
  deliverables: z.array(z.string()).min(1),
  scope: z.object({
    included: z.array(z.string()),
    excluded: z.array(z.string()),
  }),
  timeline: z.string().min(1),
  pricing: z.object({
    setup_fee: z.string().min(1),
    monthly_support: z.string(),
    payment_terms: z.string().optional(),
    pricing_notes: z.string().optional(),
  }),
  proof_plan: z.object({
    baseline_metric: z.string().min(1),
    target_metric: z.string().min(1),
    measurement_window: z.string().min(1),
  }),
  risk_controls: z.array(z.string()).default([]),
  founder_talking_points: z.array(z.string()).default([]),
});
export type Offer = z.infer<typeof OfferSchema>;

// ─── Outreach ─────────────────────────────────────────────────────
export const EmailStepSchema = z.object({
  step: z.number().int().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

export const LinkedInMessageSchema = z.object({
  step: z.number().int().min(1),
  body: z.string().min(1),
});

export const OutreachSequenceSchema = z.object({
  sequence_id: z.string().ulid(),
  offer_id: z.string().ulid(),
  channels: z.array(z.enum(["email", "linkedin"])).min(1),
  email_sequence: z.array(EmailStepSchema).default([]),
  linkedin_messages: z.array(LinkedInMessageSchema).default([]),
  objection_responses: z.array(z.object({
    objection: z.string(),
    response: z.string(),
  })).default([]),
  compliance_notes: z.array(z.string()).default([]),
});
export type OutreachSequence = z.infer<typeof OutreachSequenceSchema>;

// ─── Proposal ─────────────────────────────────────────────────────
export const ProposalSchema = z.object({
  proposal_id: z.string().ulid(),
  title: z.string().min(1),
  executive_summary: z.string().min(1),
  problem: z.string().min(1),
  recommended_solution: z.string().min(1),
  scope: z.object({
    included: z.array(z.string()),
    excluded: z.array(z.string()),
  }),
  timeline: z.array(z.object({
    day_range: z.string(),
    activity: z.string(),
  })),
  pricing: z.object({
    setup_fee: z.string().min(1),
    monthly_support: z.string(),
    payment_terms: z.string().optional(),
  }),
  success_metrics: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  risks: z.array(RiskSchema).default([]),
  next_step: z.string().min(1),
});
export type Proposal = z.infer<typeof ProposalSchema>;

// ─── QA Review ────────────────────────────────────────────────────
export const QAFixSchema = z.object({
  field: z.string(),
  issue: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  recommended_fix: z.string(),
});

export const QAReviewSchema = z.object({
  review_id: z.string().ulid(),
  artifact_type: z.enum(["opportunity_score", "offer", "outreach_sequence", "proposal"]),
  verdict: z.enum(["pass", "needs_revision", "fail"]),
  score: z.number().min(0).max(1),
  required_fixes: z.array(QAFixSchema).default([]),
  warnings: z.array(z.object({
    issue: z.string(),
    severity: z.enum(["low", "medium", "high"]),
  })).default([]),
  checks: z.object({
    schema_complete: z.boolean(),
    source_supported: z.boolean(),
    buyer_clear: z.boolean(),
    pricing_present: z.boolean(),
    unsupported_claims_absent: z.boolean(),
    compliance_safe: z.boolean(),
    founder_review_required: z.boolean(),
  }),
  approved_for_founder_review: z.boolean(),
  approved_for_sending: z.boolean(),
});
export type QAReview = z.infer<typeof QAReviewSchema>;

// ─── Lead & Deal ─────────────────────────────────────────────────
export const LeadSchema = z.object({
  lead_id: z.string().ulid().optional(),
  company_name: z.string().min(1),
  buyer_name: z.string().optional(),
  buyer_role: z.string().optional(),
  email: z.string().email().optional(),
  linkedin_url: z.string().url().optional(),
  status: z.enum(["new", "contacted", "meeting_scheduled", "qualified", "unqualified"]).default("new"),
  known_pain: z.string().optional(),
  known_tools: z.array(z.string()).default([]),
  notes: z.string().optional(),
});
export type Lead = z.infer<typeof LeadSchema>;

export const DealSchema = z.object({
  deal_id: z.string().ulid().optional(),
  lead_id: z.string().ulid().optional(),
  offer_id: z.string().ulid().optional(),
  stage: z.enum(["lead", "qualified", "proposal_sent", "negotiation", "won", "lost"]).default("lead"),
  value_cents: z.number().int().min(0).default(0),
  currency: z.string().default("usd"),
  probability: z.number().int().min(0).max(100).default(0),
  expected_close_date: z.string().optional(),
  status: z.enum(["open", "won", "lost"]).default("open"),
  lost_reason: z.string().optional(),
});
export type Deal = z.infer<typeof DealSchema>;

// ─── Agent Runtime ────────────────────────────────────────────────
export const AgentOutputSchema = z.object({
  agent_name: z.string(),
  agent_version: z.string(),
  status: z.enum(["success", "partial_success", "failure"]),
  failure_reason: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  tenant_id: TenantId,
  workflow_id: WorkflowId,
  input_summary: z.string(),
  output: z.record(z.unknown()),
  evidence: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
});
export type AgentOutput = z.infer<typeof AgentOutputSchema>;

// ─── Revenue Metrics ─────────────────────────────────────────────
export const RevenueMetricSchema = z.object({
  period: z.string(),
  mrr_cents: z.number().int(),
  arr_cents: z.number().int(),
  pipeline_cents: z.number().int(),
  closed_won_cents: z.number().int(),
  meetings_booked: z.number().int(),
  proposals_sent: z.number().int(),
  reply_rate: z.number().min(0).max(1).optional(),
});
export type RevenueMetric = z.infer<typeof RevenueMetricSchema>;

// ─── Event Types ─────────────────────────────────────────────────
export const EventType = z.enum([
  "tenant.created",
  "business_profile.updated",
  "scan.created",
  "scan.completed",
  "signal.created",
  "pain_candidate.created",
  "opportunity.scored",
  "opportunity.selected",
  "offer.created",
  "outreach.created",
  "proposal.created",
  "qa.reviewed",
  "approval.created",
  "deal.created",
  "deal.stage_changed",
  "agent_run.started",
  "agent_run.completed",
  "agent_run.failed",
]);
export type EventType = z.infer<typeof EventType>;
