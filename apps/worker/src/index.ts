import { createWorker, type JobPayload } from "@agentic/jobs";
import { createLogger } from "@agentic/logger";
import { db, schema } from "@agentic/database";
import { scan, detect, score, design, write as writeOutreach, createProposal, review } from "@agentic/ai";
import { eq } from "drizzle-orm";
import { ulid } from "ulid";

const log = createLogger({ service: "worker" });

async function recordAgentRun(
  tenantId: string,
  agentName: string,
  input: unknown,
  output: unknown,
  status: "success" | "failure",
  costCents: number,
  durationMs: number,
  failureReason?: string,
) {
  await db.insert(schema.agentRuns).values({
    tenantId,
    agentName,
    agentVersion: "1.0.0",
    input: input as Record<string, unknown>,
    output: output as Record<string, unknown>,
    status,
    confidence: status === "success" ? "0.9" : null,
    failureReason: failureReason || null,
    costCents,
    durationMs,
    createdAt: new Date(),
    completedAt: new Date(),
  });

  await db.insert(schema.auditEvents).values({
    tenantId,
    actorType: "agent",
    actorId: `${agentName}@1.0.0`,
    eventType: status === "success" ? "agent_run.completed" : "agent_run.failed",
    entityType: "agent_run",
    traceId: ulid(),
    payload: { agent_name: agentName, status, cost_cents: costCents },
  });
}

// ─── Market Scanner ───────────────────────────────────────────────
createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "scan.market") {
    const start = Date.now();
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "market_signal_scanner" });
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
      const result = await scan({
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

      // Store signals
      for (const s of result.data.signals) {
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

      // Update scan status
      await db.update(schema.scans)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(schema.scans.id, entityId));

      // Enqueue pain detection
      const { enqueueJob } = await import("@agentic/jobs");
      await enqueueJob("agent-jobs", "pain.detect", {
        tenantId,
        entityId,
        requestedByUserId: tenantId,
      });

      await recordAgentRun(
        tenantId, "market_signal_scanner",
        { scanId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "Market scan completed", {
        signals: result.data.signals.length,
        cost: result.usage.costCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await db.update(schema.scans)
        .set({ status: "failed", failureReason: msg })
        .where(eq(schema.scans.id, entityId));
      await recordAgentRun(tenantId, "market_signal_scanner", { scanId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── Pain Detector ───────────────────────────────────────────────
createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "pain.detect") {
    const start = Date.now();
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

      const result = await detect({
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

      for (const p of result.data.pain_candidates) {
        await db.insert(schema.painCandidates).values({
          tenantId,
          scanId: entityId,
          painStatement: p.pain_statement,
          affectedBuyer: p.affected_buyer,
          affectedUsers: JSON.parse(JSON.stringify(p.affected_users)),
          currentWorkaround: p.current_workaround,
          businessImpact: p.business_impact as any,
          evidenceSignalIds: JSON.parse(JSON.stringify(p.evidence_signal_ids)),
          evidenceSummary: p.evidence_summary,
          targetCustomerFit: String(p.target_customer_fit),
          painIntensity: String(p.pain_intensity),
          confidence: String(p.confidence),
        });
      }

      const { enqueueJob } = await import("@agentic/jobs");
      await enqueueJob("agent-jobs", "opportunity.score", {
        tenantId,
        entityId,
        requestedByUserId: tenantId,
      });

      await recordAgentRun(
        tenantId, "pain_detector",
        { scanId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "Pain detection completed", {
        candidates: result.data.pain_candidates.length,
        cost: result.usage.costCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordAgentRun(tenantId, "pain_detector", { scanId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── Opportunity Scorer ──────────────────────────────────────────
createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "opportunity.score") {
    const start = Date.now();
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "opportunity_scorer" });
    logJob.info("agent.started", "Opportunity scoring started");

    try {
      const profile = await db.select().from(schema.businessProfiles)
        .where(eq(schema.businessProfiles.tenantId, tenantId))
        .limit(1);
      if (!profile.length) throw new Error("Business profile not found");

      const pains = await db.select().from(schema.painCandidates)
        .where(eq(schema.painCandidates.scanId, entityId));

      if (!pains.length) throw new Error("No pain candidates found");

      const result = await score({
        tenantId,
        workflowId: entityId,
        painCandidates: pains.map(p => ({
          pain_id: p.id,
          pain_statement: p.painStatement,
          affected_buyer: p.affectedBuyer,
          current_workaround: p.currentWorkaround,
          business_impact: { cost_type: (p.businessImpact as any)?.cost_type || "labor_cost", measurable_proxy: (p.businessImpact as any)?.measurable_proxy || "" },
          confidence: Number(p.confidence),
        })),
        businessProfile: {
          deliveryCapabilities: profile[0].deliveryCapabilities as string[],
          priceRange: profile[0].priceRange || "",
          riskConstraints: profile[0].riskConstraints as string[],
        },
      });

      for (const opp of result.data.opportunity_scores) {
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
          risks: JSON.parse(JSON.stringify(opp.risks)),
          decision: opp.decision,
          confidence: String(opp.confidence),
          recommended: opp.recommended,
        });
      }

      // Mark scan complete
      await db.update(schema.scans)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(schema.scans.id, entityId));

      await recordAgentRun(
        tenantId, "opportunity_scorer",
        { scanId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "Opportunity scoring completed", {
        opportunities: result.data.opportunity_scores.length,
        topPick: result.data.top_recommendation,
        cost: result.usage.costCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordAgentRun(tenantId, "opportunity_scorer", { scanId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── Offer Designer ──────────────────────────────────────────────
createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "offer.design") {
    const start = Date.now();
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "offer_designer" });
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

      if (!opp.length) throw new Error("Linked opportunity not found");

      const b = profile[0];
      const result = await design({
        tenantId,
        workflowId: entityId,
        selectedOpportunity: {
          opportunity_id: opp[0].id,
          pain_statement: opp[0].buyer + " needs " + opp[0].idealCustomerProfile,
          buyer: opp[0].buyer,
          ideal_customer_profile: opp[0].idealCustomerProfile,
          estimated_price_range: opp[0].estimatedPriceRange || b.priceRange || "",
          risks: opp[0].risks as any[],
        },
        businessProfile: {
          companyName: b.companyName,
          deliveryCapabilities: b.deliveryCapabilities as string[],
          priceRange: b.priceRange || "",
        },
      });

      const o = result.data.offer;
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

      await recordAgentRun(
        tenantId, "offer_designer",
        { offerId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "Offer design completed", { offer: o.name, cost: result.usage.costCents });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordAgentRun(tenantId, "offer_designer", { offerId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── Outreach Writer ─────────────────────────────────────────────
createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "outreach.write") {
    const start = Date.now();
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "outreach_writer" });
    logJob.info("agent.started", "Outreach writing started");

    try {
      const seqRow = await db.select().from(schema.outreachSequences)
        .where(eq(schema.outreachSequences.id, entityId))
        .limit(1);
      if (!seqRow.length) throw new Error("Outreach sequence not found");

      const offer = await db.select().from(schema.offers)
        .where(eq(schema.offers.id, seqRow[0].offerId))
        .limit(1);
      if (!offer.length) throw new Error("Linked offer not found");

      const result = await writeOutreach({
        tenantId,
        workflowId: entityId,
        offer: {
          offer_id: offer[0].id,
          name: offer[0].name,
          one_sentence_pitch: offer[0].oneSentencePitch,
          target_customer: offer[0].targetCustomer,
          pain_addressed: offer[0].painAddressed,
          timeline: offer[0].timeline,
          pricing: offer[0].pricing as any,
        },
        outreachConfig: {
          channels: seqRow[0].channels as string[],
          tone: "direct, useful, low-hype",
          cta: "book a 15-minute fit call",
          maxEmailWords: 120,
          followUpCount: 3,
        },
      });

      const o = result.data.outreach_sequence;
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

      await recordAgentRun(
        tenantId, "outreach_writer",
        { sequenceId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "Outreach writing completed", {
        emails: o.email_sequence.length,
        cost: result.usage.costCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordAgentRun(tenantId, "outreach_writer", { sequenceId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── Proposal Writer ─────────────────────────────────────────────
createWorker("agent-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "proposal.write") {
    const start = Date.now();
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "proposal_writer" });
    logJob.info("agent.started", "Proposal writing started");

    try {
      const propRow = await db.select().from(schema.proposals)
        .where(eq(schema.proposals.id, entityId))
        .limit(1);
      if (!propRow.length) throw new Error("Proposal not found");

      const offer = await db.select().from(schema.offers)
        .where(eq(schema.offers.id, propRow[0].offerId))
        .limit(1);
      if (!offer.length) throw new Error("Linked offer not found");

      let leadContext = {
        company_name: "Prospect",
        buyer_name: "Prospect",
        buyer_role: "Decision Maker",
        known_pain: offer[0].painAddressed,
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
            known_pain: lead[0].knownPain || offer[0].painAddressed,
            known_tools: lead[0].knownTools as string[],
          };
        }
      }

      const result = await createProposal({
        tenantId,
        workflowId: entityId,
        offer: {
          offer_id: offer[0].id,
          name: offer[0].name,
          deliverables: offer[0].deliverables as string[],
          timeline: offer[0].timeline,
          pricing: offer[0].pricing as any,
        },
        leadContext,
      });

      const p = result.data.proposal;
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

      await recordAgentRun(
        tenantId, "proposal_writer",
        { proposalId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "Proposal writing completed", { cost: result.usage.costCents });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordAgentRun(tenantId, "proposal_writer", { proposalId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

// ─── QA Reviewer ─────────────────────────────────────────────────
createWorker("qa-jobs", async (job) => {
  const { tenantId, entityId } = job.data;

  if (job.name === "qa.review") {
    const start = Date.now();
    const logJob = log.child({ tenantId, jobId: job.id!, agentName: "qa_compliance_reviewer" });
    logJob.info("agent.started", "QA review started");

    try {
      const qaRow = await db.select().from(schema.qaReviews)
        .where(eq(schema.qaReviews.id, entityId))
        .limit(1);
      if (!qaRow.length) throw new Error("QA review not found");

      const artifactType = qaRow[0].artifactType as "offer" | "outreach_sequence" | "proposal";
      const artifactId = qaRow[0].artifactId;

      // Load the artifact
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

      const result = await review({
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

      const r = result.data.qa_review;
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

      await recordAgentRun(
        tenantId, "qa_compliance_reviewer",
        { reviewId: entityId }, result.data, "success",
        result.usage.costCents, Date.now() - start,
      );

      logJob.info("agent.completed", "QA review completed", {
        verdict: r.verdict,
        score: r.score,
        cost: result.usage.costCents,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await recordAgentRun(tenantId, "qa_compliance_reviewer", { reviewId: entityId }, null, "failure", 0, Date.now() - start, msg);
      logJob.error("agent.failed", msg);
      throw err;
    }
  }
});

log.info("job.started", "Worker started — listening for jobs");
console.log("Agentic Revenue OS Worker running. Waiting for queue jobs...");
