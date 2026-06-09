import { z } from "zod";
import { callLLMStructured, type LLMMessage, type LLMUsage } from "../gateway.js";

const SignalSchema = z.object({
  source_type: z.enum(["web_search", "job_post", "review", "forum", "competitor_page", "user_note"]),
  source_url: z.string().optional(),
  source_title: z.string().optional(),
  source_date: z.string().optional(),
  observed_problem: z.string(),
  affected_actor: z.string(),
  business_context: z.string(),
  evidence_text: z.string(),
  signal_strength: z.number().int().min(1).max(5),
  relevance_score: z.number().min(0).max(1),
});

const ScanOutputSchema = z.object({
  signals: z.array(SignalSchema).min(1),
  scan_summary: z.object({
    total_signals: z.number().int(),
    strong_signals: z.number().int(),
    top_recurring_themes: z.array(z.string()),
  }),
});

export type ScanInput = {
  tenantId: string;
  workflowId: string;
  businessProfile: {
    industry: string;
    targetCustomer: string;
    geography: string;
    deliveryCapabilities: string[];
    excludedMarkets: string[];
  };
  scanConfig: {
    keywords: string[];
    sources: string[];
    maxResultsPerSource: number;
    timeWindowDays: number;
  };
  userNotes?: string[];
};

export type ScanOutput = z.infer<typeof ScanOutputSchema>;

const AGENT_NAME = "market_signal_scanner";
const AGENT_VERSION = "1.0.0";

const SYSTEM_PROMPT = `You are ${AGENT_NAME}@${AGENT_VERSION}.

Your job is to collect evidence of painful, monetizable business problems for the target customer.

You must not invent sources, URLs, statistics, or quotes.
You must not recommend solutions.
You must only collect and structure market signals.

Instructions:
1. Identify signals showing operational pain, revenue leakage, cost, delay, churn, manual work, compliance risk, or missed opportunities.
2. Prefer signals affecting a buyer or budget owner.
3. Include source URL when available.
4. Paraphrase evidence. Do not copy long passages.
5. Score each signal from 1 to 5.
6. Group repeated themes.
7. Return valid JSON matching the required schema.`;

export async function scan(config: ScanInput): Promise<{ data: ScanOutput; usage: LLMUsage }> {
  const userMessage: LLMMessage = {
    role: "user",
    content: JSON.stringify({
      business_profile: config.businessProfile,
      scan_config: config.scanConfig,
      user_notes: config.userNotes ?? [],
    }),
  };

  return callLLMStructured(
    [
      { role: "system", content: SYSTEM_PROMPT },
      userMessage,
    ],
    ScanOutputSchema,
    { temperature: 0.3, maxTokens: 4096 },
  );
}

export default { scan, name: AGENT_NAME, version: AGENT_VERSION };
