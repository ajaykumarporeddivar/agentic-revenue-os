import { sql } from "drizzle-orm";
import {
  pgTable, uuid, text, jsonb, integer, numeric, boolean, date, timestamp, uniqueIndex, index,
} from "drizzle-orm/pg-core";

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  authProviderUserId: text("auth_provider_user_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantIdx: index("idx_users_tenant_id").on(table.tenantId),
}));

export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  companyName: text("company_name").notNull(),
  industry: text("industry").notNull(),
  targetCustomer: text("target_customer").notNull(),
  geography: text("geography").notNull(),
  currentOffer: text("current_offer"),
  priceRange: text("price_range"),
  deliveryCapabilities: jsonb("delivery_capabilities").notNull().default("[]"),
  excludedMarkets: jsonb("excluded_markets").notNull().default("[]"),
  riskConstraints: jsonb("risk_constraints").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scans = pgTable("scans", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  status: text("status").notNull().default("queued"),
  keywords: jsonb("keywords").notNull().default("[]"),
  sources: jsonb("sources").notNull().default("[]"),
  maxResultsPerSource: integer("max_results_per_source").notNull().default(10),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const signals = pgTable("signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  sourceTitle: text("source_title"),
  sourceDate: text("source_date"),
  observedProblem: text("observed_problem").notNull(),
  affectedActor: text("affected_actor"),
  businessContext: text("business_context"),
  evidenceText: text("evidence_text").notNull(),
  signalStrength: integer("signal_strength").notNull(),
  relevanceScore: numeric("relevance_score", { precision: 4, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  scanIdx: index("idx_signals_scan_id").on(table.scanId),
}));

export const painCandidates = pgTable("pain_candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  scanId: uuid("scan_id").notNull().references(() => scans.id),
  painStatement: text("pain_statement").notNull(),
  affectedBuyer: text("affected_buyer").notNull(),
  affectedUsers: jsonb("affected_users").notNull().default("[]"),
  currentWorkaround: text("current_workaround").notNull(),
  businessImpact: jsonb("business_impact").notNull(),
  evidenceSignalIds: jsonb("evidence_signal_ids").notNull().default("[]"),
  evidenceSummary: text("evidence_summary").notNull(),
  targetCustomerFit: numeric("target_customer_fit", { precision: 4, scale: 3 }).notNull(),
  painIntensity: numeric("pain_intensity", { precision: 4, scale: 3 }).notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  painCandidateId: uuid("pain_candidate_id").notNull().references(() => painCandidates.id),
  status: text("status").notNull().default("new"),
  recommended: boolean("recommended").notNull().default(false),
  scoreTotal: integer("score_total").notNull(),
  scoreBreakdown: jsonb("score_breakdown").notNull(),
  buyer: text("buyer").notNull(),
  idealCustomerProfile: text("ideal_customer_profile").notNull(),
  whyNow: text("why_now"),
  revenuePath: text("revenue_path").notNull(),
  estimatedPriceRange: text("estimated_price_range"),
  risks: jsonb("risks").notNull().default("[]"),
  decision: text("decision").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
  selectedAt: timestamp("selected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantStatusIdx: index("idx_opportunities_tenant_status").on(table.tenantId, table.status),
}));

export const offers = pgTable("offers", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  opportunityId: uuid("opportunity_id").notNull().references(() => opportunities.id),
  status: text("status").notNull().default("draft"),
  name: text("name").notNull(),
  oneSentencePitch: text("one_sentence_pitch").notNull(),
  targetCustomer: text("target_customer").notNull(),
  painAddressed: text("pain_addressed").notNull(),
  deliverables: jsonb("deliverables").notNull().default("[]"),
  scope: jsonb("scope").notNull(),
  timeline: text("timeline").notNull(),
  pricing: jsonb("pricing").notNull(),
  proofPlan: jsonb("proof_plan").notNull(),
  riskControls: jsonb("risk_controls").notNull().default("[]"),
  founderTalkingPoints: jsonb("founder_talking_points").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantStatusIdx2: index("idx_offers_tenant_status").on(table.tenantId, table.status),
}));

export const outreachSequences = pgTable("outreach_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  offerId: uuid("offer_id").notNull().references(() => offers.id),
  status: text("status").notNull().default("draft"),
  channels: jsonb("channels").notNull().default("[]"),
  emailSequence: jsonb("email_sequence").notNull().default("[]"),
  linkedinMessages: jsonb("linkedin_messages").notNull().default("[]"),
  objectionResponses: jsonb("objection_responses").notNull().default("[]"),
  complianceNotes: jsonb("compliance_notes").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  offerId: uuid("offer_id").notNull().references(() => offers.id),
  leadId: uuid("lead_id"),
  status: text("status").notNull().default("draft"),
  title: text("title").notNull(),
  executiveSummary: text("executive_summary").notNull(),
  problem: text("problem").notNull(),
  recommendedSolution: text("recommended_solution").notNull(),
  scope: jsonb("scope").notNull(),
  timeline: jsonb("timeline").notNull().default("[]"),
  pricing: jsonb("pricing").notNull(),
  successMetrics: jsonb("success_metrics").notNull().default("[]"),
  assumptions: jsonb("assumptions").notNull().default("[]"),
  risks: jsonb("risks").notNull().default("[]"),
  nextStep: text("next_step").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  companyName: text("company_name").notNull(),
  buyerName: text("buyer_name"),
  buyerRole: text("buyer_role"),
  email: text("email"),
  linkedinUrl: text("linkedin_url"),
  status: text("status").notNull().default("new"),
  knownPain: text("known_pain"),
  knownTools: jsonb("known_tools").notNull().default("[]"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  leadId: uuid("lead_id").references(() => leads.id),
  offerId: uuid("offer_id").references(() => offers.id),
  stage: text("stage").notNull().default("lead"),
  valueCents: integer("value_cents").notNull().default(0),
  currency: text("currency").notNull().default("usd"),
  probability: integer("probability").notNull().default(0),
  expectedCloseDate: text("expected_close_date"),
  status: text("status").notNull().default("open"),
  wonAt: timestamp("won_at", { withTimezone: true }),
  lostAt: timestamp("lost_at", { withTimezone: true }),
  lostReason: text("lost_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantStageIdx: index("idx_deals_tenant_stage").on(table.tenantId, table.stage),
}));

export const qaReviews = pgTable("qa_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  artifactType: text("artifact_type").notNull(),
  artifactId: uuid("artifact_id").notNull(),
  verdict: text("verdict").notNull(),
  score: numeric("score", { precision: 4, scale: 3 }).notNull(),
  requiredFixes: jsonb("required_fixes").notNull().default("[]"),
  warnings: jsonb("warnings").notNull().default("[]"),
  checks: jsonb("checks").notNull(),
  approvedForFounderReview: boolean("approved_for_founder_review").notNull().default(false),
  approvedForSending: boolean("approved_for_sending").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  artifactType: text("artifact_type").notNull(),
  artifactId: uuid("artifact_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  decision: text("decision").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  agentName: text("agent_name").notNull(),
  agentVersion: text("agent_version").notNull(),
  workflowId: uuid("workflow_id"),
  input: jsonb("input").notNull(),
  output: jsonb("output"),
  status: text("status").notNull(),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  failureReason: text("failure_reason"),
  costCents: integer("cost_cents").notNull().default(0),
  durationMs: integer("duration_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => ({
  tenantAgentIdx: index("idx_agent_runs_tenant_agent").on(table.tenantId, table.agentName),
}));

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  actorType: text("actor_type").notNull(),
  actorId: text("actor_id").notNull(),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  payload: jsonb("payload").notNull().default("{}"),
  traceId: text("trace_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  tenantCreatedIdx: index("idx_audit_events_tenant_created").on(table.tenantId, table.createdAt.desc()),
}));

export const revenueMetrics = pgTable("revenue_metrics", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  period: text("period").notNull(),
  mrrCents: integer("mrr_cents").notNull().default(0),
  arrCents: integer("arr_cents").notNull().default(0),
  pipelineCents: integer("pipeline_cents").notNull().default(0),
  closedWonCents: integer("closed_won_cents").notNull().default(0),
  meetingsBooked: integer("meetings_booked").notNull().default(0),
  proposalsSent: integer("proposals_sent").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
