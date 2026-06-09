import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const OutreachOutputSchema = z.object({
  outreach_sequence: z.object({
    channels: z.array(z.enum(["email", "linkedin"])).min(1),
    email_sequence: z.array(z.object({
      step: z.number().int(),
      subject: z.string(),
      body: z.string(),
    })).default([]),
    linkedin_messages: z.array(z.object({
      step: z.number().int(),
      body: z.string(),
    })).default([]),
    objection_responses: z.array(z.object({
      objection: z.string(),
      response: z.string(),
    })).default([]),
    compliance_notes: z.array(z.string()),
  }),
});

export type OutreachInput = {
  tenantId: string;
  workflowId: string;
  offer: {
    offer_id: string;
    name: string;
    one_sentence_pitch: string;
    target_customer: string;
    pain_addressed: string;
    timeline: string;
    pricing: { setup_fee: string; monthly_support: string };
  };
  outreachConfig: {
    channels: string[];
    tone: string;
    cta: string;
    maxEmailWords?: number;
    followUpCount?: number;
  };
};

export type OutreachOutput = z.infer<typeof OutreachOutputSchema>;

const AGENT_NAME = "outreach_writer";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to generate compliant, founder-reviewed outreach assets for a B2B offer.

Do not invent personalization.
Do not claim guaranteed revenue, guaranteed savings, or customer results unless provided.
Do not use manipulative language.
Write like a practical founder, not a marketing agency.

Instructions:
1. Generate cold email sequence.
2. Generate LinkedIn message sequence if requested.
3. Generate common objection responses.
4. Keep emails under the configured word limit.
5. Include compliance notes.
6. Return valid JSON only.`;

export async function write(config: OutreachInput): Promise<{ data: OutreachOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      offer: config.offer,
      outreach_config: config.outreachConfig,
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    OutreachOutputSchema,
    { temperature: 0.4, maxTokens: 4096 },
  );
}

export default { write, name: AGENT_NAME, version: AGENT_VERSION };
