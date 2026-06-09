import { createWorker, enqueueJob } from "@agentic/jobs";
import { createLogger } from "@agentic/logger";
import { db, schema } from "@agentic/database";
import {
  scan, detect, score, design, write as writeOutreach, createProposal, review,
  governor, registerAgentWithContract, onEvent, emitEvent, ALL_CONTRACTS,
} from "@agentic/ai";
import type { GovContext, AgentRunResult, AgentRunInput } from "@agentic/ai";
import { eq } from "drizzle-orm";

const log = createLogger({ service: "worker" });

// ─── Register All Agent Contracts ─────────────────────────────────
// Wire each agent's handler so the Governor can dispatch.
// Handlers receive hydrated context from Governor and return structured output.
// They NEVER read/write DB directly or call other agents.

registerAgentWithContract(ALL_CONTRACTS[0], async (input: AgentRunInput) => {
  const ctx = input.input as any;
  const result = await scan({
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    businessProfile: ctx.businessProfile,
    scanConfig: ctx.scanConfig,
    userNotes: ctx.userNotes,
  });
  return {
    success: true, output: result.data as any, confidence: 0.9,
    cost_cents: result.usage.costCents, duration_ms: 0,
  };
});

registerAgentWithContract(ALL_CONTRACTS[1], async (input: AgentRunInput) => {
  const ctx = input.input as any;
  const result = await detect({
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    signalBatchId: ctx.signalBatchId,
    signals: ctx.signals,
    businessProfile: ctx.businessProfile,
  });
  return {
    success: true, output: result.data as any, confidence: 0.9,
    cost_cents: result.usage.costCents, duration_ms: 0,
  };
});

registerAgentWithContract(ALL_CONTRACTS[2], async (input: AgentRunInput) => {
  const ctx = input.input as any;
  const result = await score({
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    painCandidates: ctx.painCandidates,
    businessProfile: ctx.businessProfile,
  });
  return {
    success: true, output: result.data as any, confidence: 0.9,
    cost_cents: result.usage.costCents, duration_ms: 0,
  };
});

registerAgentWithContract(ALL_CONTRACTS[10], async (input: AgentRunInput) => {
  const ctx = input.input as any;
  const result = await writeOutreach({
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    offer: ctx.offer,
    outreachConfig: ctx.outreachConfig,
  });
  return {
    success: true, output: result.data as any, confidence: 0.9,
    cost_cents: result.usage.costCents, duration_ms: 0,
  };
});

registerAgentWithContract(ALL_CONTRACTS[11], async (input: AgentRunInput) => {
  const ctx = input.input as any;
  const result = await createProposal({
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    offer: ctx.offer,
    leadContext: ctx.leadContext,
  });
  return {
    success: true, output: result.data as any, confidence: 0.9,
    cost_cents: result.usage.costCents, duration_ms: 0,
  };
});

registerAgentWithContract(ALL_CONTRACTS[8], async (input: AgentRunInput) => {
  const ctx = input.input as any;
  const result = await review({
    tenantId: ctx.tenantId,
    workflowId: ctx.workflowId,
    artifactType: ctx.artifactType,
    artifact: ctx.artifact,
    sourceEvidence: ctx.sourceEvidence ?? [],
    businessProfile: ctx.businessProfile,
    reviewPolicy: ctx.reviewPolicy,
  });
  return {
    success: true, output: result.data as any, confidence: 0.9,
    cost_cents: result.usage.costCents, duration_ms: 0,
  };
});

// Also register the remaining contracts as no-op stubs so they're in the registry
// Real implementations to follow
registerAgentWithContract(ALL_CONTRACTS[3], async () => ({
  success: true, output: { stub: true, message: "economic_analyst not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[4], async () => ({
  success: true, output: { stub: true, message: "sme_panel_coordinator not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[5], async () => ({
  success: true, output: { stub: true, message: "product_spec_writer not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[6], async () => ({
  success: true, output: { stub: true, message: "task_graph_builder not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[7], async () => ({
  success: true, output: { stub: true, message: "builder_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[9], async () => ({
  success: true, output: { stub: true, message: "deploy_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[12], async () => ({
  success: true, output: { stub: true, message: "customer_success_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[13], async () => ({
  success: true, output: { stub: true, message: "revops_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[14], async () => ({
  success: true, output: { stub: true, message: "compliance_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[15], async () => ({
  success: true, output: { stub: true, message: "observability_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));
registerAgentWithContract(ALL_CONTRACTS[16], async () => ({
  success: true, output: { stub: true, message: "meta_agent not yet implemented" },
  confidence: 0.1, cost_cents: 0, duration_ms: 0,
}));

// ─── Event Bus: Record Agent Runs ─────────────────────────────────
// Listen for agent completion/failure events and write to DB.
// This is the ONLY code that writes to the agentRuns table.
onEvent("agent_run.completed", async (event) => {
  const { tenant_id, run_id, workflow_id, actor } = event;
  const payload = event.payload as any;
  const agentName = payload.agent_name;

  await db.insert(schema.agentRuns).values({
    tenantId: tenant_id,
    agentName,
    agentVersion: "1.0.0",
    input: event.payload as any,
    output: payload,
    status: payload.status === "success" ? "success" : "failure",
    confidence: payload.status === "success" ? "0.9" : "0.1",
    costCents: payload.cost_cents ?? 0,
    durationMs: payload.duration_ms ?? 0,
    createdAt: new Date(),
    completedAt: new Date(),
  });

  await db.insert(schema.auditEvents).values({
    tenantId: tenant_id,
    actorType: actor.type,
    actorId: actor.id,
    eventType: event.event_type,
    entityType: "agent_run",
    traceId: event.trace_id ?? run_id ?? null,
    payload: { agent_name: agentName, status: payload.status, cost_cents: payload.cost_cents },
  });
});

onEvent("agent_run.failed", async (event) => {
  const { tenant_id, run_id, actor } = event;
  const payload = event.payload as any;

  await db.insert(schema.agentRuns).values({
    tenantId: tenant_id,
    agentName: payload.agent_name,
    agentVersion: "1.0.0",
    input: event.payload as any,
    output: null as any,
    status: "failure",
    confidence: null,
    failureReason: payload.reason ?? null,
    costCents: 0,
    durationMs: 0,
    createdAt: new Date(),
    completedAt: new Date(),
  });

  await db.insert(schema.auditEvents).values({
    tenantId: tenant_id,
    actorType: actor.type,
    actorId: actor.id,
    eventType: event.event_type,
    entityType: "agent_run",
    traceId: event.trace_id ?? run_id ?? null,
    payload: { agent_name: payload.agent_name, reason: payload.reason },
  });
});

// ─── Helper: Run agent via Governor ───────────────────────────────
async function runAgent(
  agentName: string,
  tenantId: string,
  workflowId: string,
  data: Record<string, unknown>,
  correlationId?: string,
) {
  const ctx: GovContext = {
    tenantId,
    workflowId,
    correlationId: correlationId ?? workflowId,
    actor: { type: "system", id: `worker/${agentName}` },
    data,
  };
  return governor.run(agentName, ctx);
}

// ─── BullMQ Worker ────────────────────────────────────────────────
// Worker pulls jobs from the queue, creates GovContext, delegates to Governor.
// Agent-to-agent chaining is done via Event Bus subscribers, NOT direct enqueueJob.

createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;
  const start = Date.now();

  // ── Market Scanner ──────────────────────────────────────
  if (job.name === "scan.market") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "market_scanner" });
    logJob.info("agent.started", "Market scan started");

    try {
      const profile = await db.select().from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.tenantId, tenantId))
        .limit(1);
      if (!profile.length) throw new Error("Business profile not found");

      const scanRow = await db.select().from(schema.scans)
        .where(eq(schema.scans.id, entityId))
        .limit(1);
      if (!scanRow.length) throw new Error("Scan not found");

      const b = profile[0];

      const result = await runAgent("market_scanner", tenantId, entityId, {
        tenantId,
        workflowId: entityId,
        businessProfile: {
          industry: b.industry,
          targetCustomer: b.targetCustomer,
          geography: b.geography,
          deliveryCapabilities: b.deliveryCapabilities as string[],
          excludedMarkets: b.excludedMarkets as string[],
        },
        scanConfig: {
          keywords: scanRow[0].keywords as string[],
          sources: scanRow[0].sources as string[],
          maxResultsPerSource: scanRow[0].maxResultsPerSource,
          timeWindowDays: 365,
        },
      });

      if (!result.success || !result.output) throw new Error(result.failure_reason ?? "Agent failed");

      // Store signals (GovContext data writing — this writes scan-specific results)
      const output = result.output as any;
      for (const s of output.signals) {
        await db.insert(schema.signals).values({
          tenantId,
          scanId: entityId,
          sourceType: s.source_type,
          sourceUrl: s.source_url || null,
          sourceTitle: s.source_title || null,
          sourceDate: s.source_date || null,
          observedProblem: s.observed_problem,
          affectedActor: s.affected_actor || null,
          businessContext: s.business_context || null,
          evidenceText: s.evidence_text,
          signalStrength: s.signal_strength,
          relevanceScore: String(s.relevance_score),
        });
      }

      await db.update(schema.scans)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(schema.scans.id, entityId));

      // Chain via Event Bus, not direct enqueueJob
      await emitEvent({
        event_type: "scan.completed",
        tenant_id: tenantId,
        workflow_id: entityId,
        correlation_id: entityId,
        causation_id: entityId,
        actor: { type: "agent", id: "market_scanner@1.0.0" },
        payload: { scanId: entityId, signalCount: output.signals?.length ?? 0 },
      });

      logJob.info("agent.completed", "Market scan completed", {
        signals: output.signals?.length ?? 0,
        cost: result.cost_cents,
        duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await db.update(schema.scans)
        .set({ status: "failed", failureReason: msg })
        .where(eq(schema.scans.id, entityId));
      logJob.error("agent.failed", msg);
      throw err;
    }
  }

  // ── Pain Detector ─────────────────────────────────────────
  if (job.name === "pain.detect") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "pain_detector" });
    logJob.info("agent.started", "Pain detection started");

    try {
      const profile = await db.select().from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.tenantId, tenantId))
        .limit(1);
      if (!profile.length) throw new Error("Business profile not found");

      const signals = await db.select().from(schema.signals)
        .where(eq(schema.signals.scanId, entityId));
      if (!signals.length) throw new Error("No signals found for scan");

      const result = await runAgent("pain_detector", tenantId, entityId, {
        tenantId,
        workflowId: entityId,
        signalBatchId: entityId,
        signals: signals.map(s => ({
          signal_id: s.id,
          observed_problem: s.observedProblem,
          affected_actor: s.affectedActor || undefined,
          business_context: s.businessContext || undefined,
          signal_strength: s.signalStrength,
          relevance_score: Number(s.relevanceScore),
        })),
        businessProfile: {
          targetCustomer: profile[0].targetCustomer,
          deliveryCapabilities: profile[0].deliveryCapabilities as string[],
        },
      });

      if (!result.success || !result.output) throw new Error(result.failure_reason ?? "Agent failed");

      const output = result.output as any;
      for (const p of output.pain_candidates) {
        await db.insert(schema.painCandidates).values({
          tenantId,
          scanId: entityId,
          painStatement: p.pain_statement,
          affectedBuyer: p.affected_buyer,
          affectedUsers: JSON.parse(JSON.stringify(p.affected_users ?? [])),
          currentWorkaround: p.current_workaround,
          businessImpact: p.business_impact as any,
          evidenceSignalIds: JSON.parse(JSON.stringify(p.evidence_signal_ids ?? [])),
          evidenceSummary: p.evidence_summary,
          targetCustomerFit: String(p.target_customer_fit),
          painIntensity: String(p.pain_intensity),
          confidence: String(p.confidence),
        });
      }

      await emitEvent({
        event_type: "pain.detected",
        tenant_id: tenantId,
        workflow_id: entityId,
        correlation_id: entityId,
        causation_id: entityId,
        actor: { type: "agent", id: "pain_detector@1.0.0" },
        payload: { scanId: entityId, candidateCount: output.pain_candidates?.length ?? 0 },
      });

      logJob.info("agent.completed", "Pain detection completed", {
        candidates: output.pain_candidates?.length ?? 0,
        cost: result.cost_cents,
        duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logJob.error("agent.failed", msg);
      throw err;
    }
  }

  // ── Opportunity Scorer ─────────────────────────────────────
  if (job.name === "opportunity.score") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "opportunity_validator" });
    logJob.info("agent.started", "Opportunity scoring started");

    try {
      const profile = await db.select().from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.tenantId, tenantId))
        .limit(1);
      if (!profile.length) throw new Error("Business profile not found");

      const pains = await db.select().from(schema.painCandidates)
        .where(eq(schema.painCandidates.scanId, entityId));
      if (!pains.length) throw new Error("No pain candidates found");

      const result = await runAgent("opportunity_validator", tenantId, entityId, {
        tenantId,
        workflowId: entityId,
        painCandidates: pains.map(p => ({
          pain_id: p.id,
          pain_statement: p.painStatement,
          affected_buyer: p.affectedBuyer,
          current_workaround: p.currentWorkaround,
          business_impact: {
            cost_type: (p.businessImpact as any)?.cost_type || "labor_cost",
            measurable_proxy: (p.businessImpact as any)?.measurable_proxy || "",
          },
          confidence: Number(p.confidence),
        })),
        businessProfile: {
          deliveryCapabilities: profile[0].deliveryCapabilities as string[],
          priceRange: profile[0].priceRange || "",
          riskConstraints: profile[0].riskConstraints as string[],
        },
      });

      if (!result.success || !result.output) throw new Error(result.failure_reason ?? "Agent failed");

      const output = result.output as any;
      for (const opp of output.opportunity_scores) {
        await db.insert(schema.opportunities).values({
          tenantId,
          painCandidateId: opp.pain_id,
          scoreTotal: opp.score_total,
          scoreBreakdown: opp.score_breakdown as any,
          buyer: opp.buyer,
          idealCustomerProfile: opp.ideal_customer_profile,
          whyNow: opp.why_now || null,
          revenuePath: opp.revenue_path,
          estimatedPriceRange: opp.estimated_price_range || null,
          risks: JSON.parse(JSON.stringify(opp.risks ?? [])),
          decision: opp.decision,
          confidence: String(opp.confidence),
          recommended: opp.recommended,
        });
      }

      await db.update(schema.scans)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(schema.scans.id, entityId));

      await emitEvent({
        event_type: "opportunity.scored",
        tenant_id: tenantId,
        workflow_id: entityId,
        correlation_id: entityId,
        causation_id: entityId,
        actor: { type: "agent", id: "opportunity_validator@1.0.0" },
        payload: { scanId: entityId, opportunityCount: output.opportunity_scores?.length ?? 0 },
      });

      logJob.info("agent.completed", "Opportunity scoring completed", {
        opportunities: output.opportunity_scores?.length ?? 0,
        topPick: output.top_recommendation,
        cost: result.cost_cents,
        duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logJob.error("agent.failed", msg);
      throw err;
    }
  }

  // ── Offer Designer ─────────────────────────────────────────
  if (job.name === "offer.design") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "product_spec_writer" });
    logJob.info("agent.started", "Offer design started");

    try {
      const profile = await db.select().from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.tenantId, tenantId))
        .limit(1);
      if (!profile.length) throw new Error("Business profile not found");

      const offer = await db.select().from(schema.offers)
        .where(eq(schema.offers.id, entityId))
        .limit(1);
      if (!offer.length) throw new Error("Offer not found");

      const opp = await db.select().from(schema.opportunities)
        .where(eq(schema.opportunities.id, offer[0].opportunityId))
        .limit(1);

      const b = profile[0];
      const result = await runAgent("market_scanner", tenantId, entityId, {}); // Fallback — use design function directly

      // Design still runs directly since offer designer ≠ product spec writer yet
      const designResult = await design({
        tenantId,
        workflowId: entityId,
        selectedOpportunity: opp.length ? {
          opportunity_id: opp[0].id,
          pain_statement: opp[0].buyer + " needs " + opp[0].idealCustomerProfile,
          buyer: opp[0].buyer,
          ideal_customer_profile: opp[0].idealCustomerProfile,
          estimated_price_range: opp[0].estimatedPriceRange || b.priceRange || "",
          risks: opp[0].risks as any[],
        } : {
          opportunity_id: "", pain_statement: "", buyer: "",
          ideal_customer_profile: "", estimated_price_range: "", risks: [],
        },
        businessProfile: {
          companyName: b.companyName,
          deliveryCapabilities: b.deliveryCapabilities as string[],
          priceRange: b.priceRange || "",
        },
      });

      const o = designResult.data.offer;
      await db.update(schema.offers)
        .set({
          name: o.name,
          oneSentencePitch: o.one_sentence_pitch,
          targetCustomer: o.target_customer,
          painAddressed: o.pain_addressed,
          deliverables: JSON.parse(JSON.stringify(o.deliverables)),
          scope: o.scope as any,
          timeline: o.timeline,
          pricing: o.pricing as any,
          proofPlan: o.proof_plan as any,
          riskControls: JSON.parse(JSON.stringify(o.risk_controls)),
          founderTalkingPoints: JSON.parse(JSON.stringify(o.founder_talking_points)),
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(schema.offers.id, entityId));

      await emitEvent({
        event_type: "offer.created",
        tenant_id: tenantId,
        workflow_id: entityId,
        correlation_id: entityId,
        causation_id: entityId,
        actor: { type: "agent", id: "offer_designer@1.0.0" },
        payload: { offerId: entityId },
      });

      logJob.info("agent.completed", "Offer design completed", {
        offer: o.name, cost: designResult.usage.costCents,
        duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logJob.error("agent.failed", msg);
      throw err;
    }
  }

  // ── Outreach Writer ────────────────────────────────────────
  if (job.name === "outreach.write") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "outreach_agent" });
    logJob.info("agent.started", "Outreach writing started");

    try {
      const seqRow = await db.select().from(schema.outreachSequences)
        .where(eq(schema.outreachSequences.id, entityId))
        .limit(1);
      if (!seqRow.length) throw new Error("Outreach sequence not found");

      const offer = await db.select().from(schema.offers)
        .where(eq(schema.offers.id, seqRow[0].offerId))
        .limit(1);

      const result = await runAgent("outreach_agent", tenantId, entityId, {
        tenantId,
        workflowId: entityId,
        offer: offer.length ? {
          offer_id: offer[0].id,
          name: offer[0].name,
          one_sentence_pitch: offer[0].oneSentencePitch,
          target_customer: offer[0].targetCustomer,
          pain_addressed: offer[0].painAddressed,
          timeline: offer[0].timeline,
          pricing: offer[0].pricing as any,
        } : null,
        outreachConfig: {
          channels: seqRow[0].channels as string[],
          tone: "direct, useful, low-hype",
          cta: "book a 15-minute fit call",
          maxEmailWords: 120,
          followUpCount: 3,
        },
      });

      if (!result.success || !result.output) throw new Error(result.failure_reason ?? "Agent failed");

      const output = result.output as any;
      const o = output.outreach_sequence;
      await db.update(schema.outreachSequences)
        .set({
          emailSequence: JSON.parse(JSON.stringify(o.email_sequence)),
          linkedinMessages: JSON.parse(JSON.stringify(o.linkedin_messages)),
          objectionResponses: JSON.parse(JSON.stringify(o.objection_responses)),
          complianceNotes: JSON.parse(JSON.stringify(o.compliance_notes)),
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(schema.outreachSequences.id, entityId));

      logJob.info("agent.completed", "Outreach writing completed", {
        emails: o.email_sequence?.length ?? 0,
        cost: result.cost_cents,
        duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logJob.error("agent.failed", msg);
      throw err;
    }
  }

  // ── Proposal Writer ────────────────────────────────────────
  if (job.name === "proposal.write") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "sales_agent" });
    logJob.info("agent.started", "Proposal writing started");

    try {
      const propRow = await db.select().from(schema.proposals)
        .where(eq(schema.proposals.id, entityId))
        .limit(1);
      if (!propRow.length) throw new Error("Proposal not found");

      const offer = await db.select().from(schema.offers)
        .where(eq(schema.offers.id, propRow[0].offerId))
        .limit(1);

      let leadContext = {
        company_name: "Prospect",
        buyer_name: "Prospect",
        buyer_role: "Decision Maker",
        known_pain: offer.length ? offer[0].painAddressed : "",
        known_tools: [] as string[],
      };

      if (propRow[0].leadId) {
        const lead = await db.select().from(schema.leads)
          .where(eq(schema.leads.id, propRow[0].leadId))
          .limit(1);
        if (lead.length) {
          leadContext = {
            company_name: lead[0].companyName,
            buyer_name: lead[0].buyerName || "Prospect",
            buyer_role: lead[0].buyerRole || "Decision Maker",
            known_pain: lead[0].knownPain || leadContext.known_pain,
            known_tools: lead[0].knownTools as string[],
          };
        }
      }

      const result = await runAgent("sales_agent", tenantId, entityId, {
        tenantId,
        workflowId: entityId,
        offer: offer.length ? {
          offer_id: offer[0].id,
          name: offer[0].name,
          deliverables: offer[0].deliverables as string[],
          timeline: offer[0].timeline,
          pricing: offer[0].pricing as any,
        } : null,
        leadContext,
      });

      if (!result.success || !result.output) throw new Error(result.failure_reason ?? "Agent failed");

      const output = result.output as any;
      const p = output.proposal;
      await db.update(schema.proposals)
        .set({
          title: p.title,
          executiveSummary: p.executive_summary,
          problem: p.problem,
          recommendedSolution: p.recommended_solution,
          scope: p.scope as any,
          timeline: JSON.parse(JSON.stringify(p.timeline)),
          pricing: p.pricing as any,
          successMetrics: JSON.parse(JSON.stringify(p.success_metrics)),
          assumptions: JSON.parse(JSON.stringify(p.assumptions)),
          risks: JSON.parse(JSON.stringify(p.risks)),
          nextStep: p.next_step,
          status: "draft",
          updatedAt: new Date(),
        })
        .where(eq(schema.proposals.id, entityId));

      logJob.info("agent.completed", "Proposal writing completed", {
        cost: result.cost_cents, duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logJob.error("agent.failed", msg);
      throw err;
    }
  }

  // ── QA Reviewer ────────────────────────────────────────────
  if (job.name === "qa.review") {
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "qa_repair_agent" });
    logJob.info("agent.started", "QA review started");

    try {
      const qaRow = await db.select().from(schema.qaReviews)
        .where(eq(schema.qaReviews.id, entityId))
        .limit(1);
      if (!qaRow.length) throw new Error("QA review not found");

      const artifactType = qaRow[0].artifactType as "offer" | "outreach_sequence" | "proposal";
      const artifactId = qaRow[0].artifactId;

      let artifact: Record<string, unknown> = {};
      if (artifactType === "offer") {
        const offer = await db.select().from(schema.offers)
          .where(eq(schema.offers.id, artifactId))
          .limit(1);
        if (offer.length) artifact = offer[0] as any;
      } else if (artifactType === "outreach_sequence") {
        const seq = await db.select().from(schema.outreachSequences)
          .where(eq(schema.outreachSequences.id, artifactId))
          .limit(1);
        if (seq.length) artifact = seq[0] as any;
      } else if (artifactType === "proposal") {
        const prop = await db.select().from(schema.proposals)
          .where(eq(schema.proposals.id, artifactId))
          .limit(1);
        if (prop.length) artifact = prop[0] as any;
      }

      const profile = await db.select().from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.tenantId, tenantId))
        .limit(1);

      const result = await runAgent("qa_repair_agent", tenantId, entityId, {
        tenantId,
        workflowId: entityId,
        artifactType: artifactType as any,
        artifact,
        sourceEvidence: [],
        businessProfile: {
          riskConstraints: profile.length ? (profile[0].riskConstraints as string[]) : [],
        },
        reviewPolicy: {
          requireSourceSupport: true,
          requireFounderApprovalBeforeSend: true,
          allowColdEmail: true,
          requireUnsubscribeNote: true,
        },
      });

      if (!result.success || !result.output) throw new Error(result.failure_reason ?? "Agent failed");

      const output = result.output as any;
      const r = output.qa_review;
      await db.update(schema.qaReviews)
        .set({
          verdict: r.verdict,
          score: String(r.score),
          requiredFixes: JSON.parse(JSON.stringify(r.required_fixes)),
          warnings: JSON.parse(JSON.stringify(r.warnings)),
          checks: r.checks as any,
          approvedForFounderReview: r.approved_for_founder_review,
          approvedForSending: r.approved_for_sending,
        })
        .where(eq(schema.qaReviews.id, entityId));

      logJob.info("agent.completed", "QA review completed", {
        verdict: r.verdict, score: r.score,
        cost: result.cost_cents, duration: Date.now() - start,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── Event Bus: Chain Jobs via Events ─────────────────────────────
// Agent-to-agent chaining is done here, NOT inside agent handlers.
onEvent("scan.completed", async (event) => {
  const wid = event.workflow_id!;
  await enqueueJob("agent-jobs", "pain.detect", {
    tenantId: event.tenant_id,
    entityId: wid,
    requestedByUserId: event.tenant_id,
  });
});

onEvent("pain.detected", async (event) => {
  const wid = event.workflow_id!;
  await enqueueJob("agent-jobs", "opportunity.score", {
    tenantId: event.tenant_id,
    entityId: wid,
    requestedByUserId: event.tenant_id,
  });
});

log.info("job.started", "Worker started — listening for jobs");
console.log("Agentic Revenue OS Worker running with Governor + Event Bus.");
