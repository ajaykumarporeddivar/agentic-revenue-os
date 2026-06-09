import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const ProposalOutputSchema = z.object({
  proposal: z.object({
    title: z.string(),
    executive_summary: z.string(),
    problem: z.string(),
    recommended_solution: z.string(),
    scope: z.object({
      included: z.array(z.string()),
      excluded: z.array(z.string()),
    }),
    timeline: z.array(z.object({
      day_range: z.string(),
      activity: z.string(),
    })),
    pricing: z.object({
      setup_fee: z.string(),
      monthly_support: z.string(),
      payment_terms: z.string().optional(),
    }),
    success_metrics: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
    risks: z.array(z.object({
      risk: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string().optional(),
    })).default([]),
    next_step: z.string(),
  }),
});

export type ProposalInput = {
  tenantId: string;
  workflowId: string;
  offer: {
    offer_id: string;
    name: string;
    deliverables: string[];
    timeline: string;
    pricing: { setup_fee: string; monthly_support: string };
  };
  leadContext: {
    company_name: string;
    buyer_name: string;
    buyer_role: string;
    known_pain: string;
    known_tools: string[];
    meeting_notes?: string;
  };
};

export type ProposalOutput = z.infer<typeof ProposalOutputSchema>;

const AGENT_NAME = "proposal_writer";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to create a practical B2B sales proposal from an approved offer and lead context.

Do not invent company facts.
Do not invent meeting notes.
Do not make unsupported ROI promises.
Use only the approved offer for scope and pricing.

Instructions:
1. Write a concise proposal.
2. Include executive summary, problem, solution, scope, timeline, pricing, success metrics, assumptions, risks, and next step.
3. Personalize only using provided lead_context.
4. Return valid JSON only.`;

export async function createProposal(config: ProposalInput): Promise<{ data: ProposalOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      offer: config.offer,
      lead_context: config.leadContext,
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    ProposalOutputSchema,
    { temperature: 0.3, maxTokens: 4096 },
  );
}

export default { createProposal, name: AGENT_NAME, version: AGENT_VERSION };
