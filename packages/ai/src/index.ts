export { callLLM, callLLMStructured } from "./gateway.js";
export type { LLMMessage, LLMConfig, LLMUsage, LLMResponse } from "./gateway.js";

export { scan } from "./agents/market-signal-scanner.js";
export type { ScanInput, ScanOutput } from "./agents/market-signal-scanner.js";

export { detect } from "./agents/pain-detector.js";
export type { PainInput, PainOutput } from "./agents/pain-detector.js";

export { score } from "./agents/opportunity-scorer.js";
export type { ScoreInput, ScoreOutput } from "./agents/opportunity-scorer.js";

export { design } from "./agents/offer-designer.js";
export type { OfferInput, OfferOutput } from "./agents/offer-designer.js";

export { write } from "./agents/outreach-writer.js";
export type { OutreachInput, OutreachOutput } from "./agents/outreach-writer.js";

export { createProposal } from "./agents/proposal-writer.js";
export type { ProposalInput, ProposalOutput } from "./agents/proposal-writer.js";

export { review } from "./agents/qa-compliance-reviewer.js";
export type { QAInput, QAOutput } from "./agents/qa-compliance-reviewer.js";
