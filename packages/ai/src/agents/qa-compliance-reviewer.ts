import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const QAOutputSchema = z.object({
  qa_review: z.object({
    verdict: z.enum(["pass", "needs_revision", "fail"]),
    score: z.number().min(0).max(1),
    required_fixes: z.array(z.object({
      field: z.string(),
      issue: z.string(),
      severity: z.enum(["low", "medium", "high", "critical"]),
      recommended_fix: z.string(),
    })).default([]),
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
  }),
});

export type QAInput = {
  tenantId: string;
  workflowId: string;
  artifactType: "opportunity_score" | "offer" | "outreach_sequence" | "proposal";
  artifact: Record<string, unknown>;
  sourceEvidence: string[];
  businessProfile: {
    riskConstraints: string[];
  };
  reviewPolicy: {
    requireSourceSupport: boolean;
    requireFounderApprovalBeforeSend: boolean;
    allowColdEmail: boolean;
    requireUnsubscribeNote: boolean;
  };
};

export type QAOutput = z.infer<typeof QAOutputSchema>;

const AGENT_NAME = "qa_compliance_reviewer";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to review generated business artifacts for quality, factual support, and compliance risk.

You are strict but practical.
Do not rewrite the artifact unless asked.
Identify exact issues and required fixes.
Block unsupported claims, invented facts, illegal outreach, deceptive language, and missing required fields.

Instructions:
1. Check schema completeness.
2. Check whether claims are supported by source evidence or user-provided context.
3. Check buyer, pain, scope, pricing, and next action clarity.
4. Check for unsupported ROI, revenue, savings, or customer claims.
5. Check outreach compliance requirements.
6. Return verdict: pass, needs_revision, or fail.
7. Include exact required fixes.
8. Return valid JSON only.`;

export async function review(config: QAInput): Promise<{ data: QAOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      artifact_type: config.artifactType,
      artifact: config.artifact,
      source_evidence: config.sourceEvidence,
      business_profile: config.businessProfile,
      review_policy: config.reviewPolicy,
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    QAOutputSchema,
    { temperature: 0.1, maxTokens: 4096 },
  );
}

export default { review, name: AGENT_NAME, version: AGENT_VERSION };
