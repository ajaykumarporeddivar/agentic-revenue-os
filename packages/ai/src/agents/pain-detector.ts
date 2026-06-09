import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const PainOutputSchema = z.object({
  pain_candidates: z.array(z.object({
    pain_statement: z.string(),
    affected_buyer: z.string(),
    affected_users: z.array(z.string()),
    current_workaround: z.string(),
    business_impact: z.object({
      cost_type: z.enum(["labor_cost", "lost_revenue", "churn_risk", "speed_delay", "compliance_risk"]),
      impact_description: z.string(),
      measurable_proxy: z.string(),
    }),
    evidence_signal_ids: z.array(z.string()).min(1),
    evidence_summary: z.string(),
    target_customer_fit: z.number().min(0).max(1),
    pain_intensity: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  })).min(1),
});

export type PainInput = {
  tenantId: string;
  workflowId: string;
  signalBatchId: string;
  signals: Array<{
    signal_id: string;
    observed_problem: string;
    affected_actor?: string;
    business_context?: string;
    signal_strength: number;
    relevance_score: number;
  }>;
  businessProfile: {
    targetCustomer: string;
    deliveryCapabilities: string[];
  };
};

export type PainOutput = z.infer<typeof PainOutputSchema>;

const AGENT_NAME = "pain_detector";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to convert raw market signals into evidence-backed business pain candidates.

You must not invent pain, buyers, or evidence.
You must not design solutions.
You must not include pain candidates that lack evidence.

Instructions:
1. Cluster signals into recurring pain themes.
2. For each theme, identify the buyer, affected users, current workaround, and measurable business impact.
3. Use only evidence from provided signals.
4. Prefer pains that match the user's delivery capabilities.
5. Return 3 to 7 strongest pain candidates.
6. Include evidence_signal_ids for every pain candidate.
7. Return valid JSON only.`;

export async function detect(config: PainInput): Promise<{ data: PainOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      signal_batch_id: config.signalBatchId,
      signals: config.signals,
      business_profile: config.businessProfile,
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    PainOutputSchema,
    { temperature: 0.3, maxTokens: 4096 },
  );
}

export default { detect, name: AGENT_NAME, version: AGENT_VERSION };
