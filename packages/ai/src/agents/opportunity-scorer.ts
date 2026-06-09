import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const ScoreOutputSchema = z.object({
  opportunity_scores: z.array(z.object({
    pain_id: z.string(),
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
    buyer: z.string(),
    ideal_customer_profile: z.string(),
    why_now: z.string(),
    revenue_path: z.string(),
    estimated_price_range: z.string(),
    risks: z.array(z.object({
      risk: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string().optional(),
    })),
    decision: z.enum(["pursue", "monitor", "reject"]),
    confidence: z.number().min(0).max(1),
  })),
  top_recommendation: z.string(),
});

export type ScoreInput = {
  tenantId: string;
  workflowId: string;
  painCandidates: Array<{
    pain_id: string;
    pain_statement: string;
    affected_buyer: string;
    current_workaround: string;
    business_impact: { cost_type: string; measurable_proxy: string };
    confidence: number;
  }>;
  businessProfile: {
    deliveryCapabilities: string[];
    priceRange: string;
    riskConstraints: string[];
  };
};

export type ScoreOutput = z.infer<typeof ScoreOutputSchema>;

const AGENT_NAME = "opportunity_scorer";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to score pain candidates for near-term revenue potential.

You are acting for a startup founder with limited resources and 30 days.
Prefer opportunities that can create sales conversations quickly.
Do not recommend abstract platforms or long R&D projects.

Scoring rubric:
- urgency: 0-20 (how urgent is this pain right now?)
- willingness_to_pay: 0-20 (will the buyer pay to fix it?)
- ease_of_delivery: 0-20 (can we deliver this with current capabilities?)
- speed_to_revenue: 0-20 (how fast can we generate revenue?)
- competitive_gap: 0-10 (is there a gap in the market?)
- evidence_confidence: 0-10 (how strong is the evidence?)

Decision thresholds:
- 80-100 = pursue
- 65-79 = monitor
- 0-64 = reject

Automatic reject if: no buyer, no measurable impact, not deliverable, no revenue path.`;

export async function score(config: ScoreInput): Promise<{ data: ScoreOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      pain_candidates: config.painCandidates,
      business_profile: config.businessProfile,
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    ScoreOutputSchema,
    { temperature: 0.2, maxTokens: 4096 },
  );
}

export default { score, name: AGENT_NAME, version: AGENT_VERSION };
