import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const OfferOutputSchema = z.object({
  offer: z.object({
    name: z.string(),
    one_sentence_pitch: z.string(),
    target_customer: z.string(),
    pain_addressed: z.string(),
    deliverables: z.array(z.string()).min(1),
    scope: z.object({
      included: z.array(z.string()),
      excluded: z.array(z.string()),
    }),
    timeline: z.string(),
    pricing: z.object({
      setup_fee: z.string(),
      monthly_support: z.string(),
      pricing_notes: z.string().optional(),
    }),
    proof_plan: z.object({
      baseline_metric: z.string(),
      target_metric: z.string(),
      measurement_window: z.string(),
    }),
    risk_controls: z.array(z.string()),
    founder_talking_points: z.array(z.string()),
  }),
});

export type OfferInput = {
  tenantId: string;
  workflowId: string;
  selectedOpportunity: {
    opportunity_id: string;
    pain_statement: string;
    buyer: string;
    ideal_customer_profile: string;
    estimated_price_range: string;
    risks: Array<{ risk: string; mitigation?: string }>;
  };
  businessProfile: {
    companyName: string;
    deliveryCapabilities: string[];
    priceRange: string;
  };
};

export type OfferOutput = z.infer<typeof OfferOutputSchema>;

const AGENT_NAME = "offer_designer";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to turn a validated opportunity into a narrow, sellable B2B offer.

You are designing for a founder with 30 days and limited resources.
Avoid platform ideas, broad transformation language, and vague deliverables.
Create a fixed-scope offer that can generate sales conversations quickly.

Instructions:
1. Create one specific offer.
2. Name the buyer and target customer.
3. Include one-sentence pitch.
4. Include deliverables, included scope, excluded scope, timeline, pricing, proof plan, and risk controls.
5. Do not make unsupported ROI or revenue guarantees.
6. Return valid JSON only.`;

export async function design(config: OfferInput): Promise<{ data: OfferOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      selected_opportunity: config.selectedOpportunity,
      business_profile: config.businessProfile,
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    OfferOutputSchema,
    { temperature: 0.3, maxTokens: 4096 },
  );
}

export default { design, name: AGENT_NAME, version: AGENT_VERSION };
