export { callLLM, callLLMStructured } from "./gateway.js";
export type { LLMMessage, LLMConfig, LLMUsage, LLMResponse } from "./gateway.js";

// Runtime: Governor, Event Bus, Registry, Memory tiers, Tools
export {
  governor, registerAgent, getContract, listAgents,
  onEvent, offEvent, emitEvent,
  registerHandler, registerAgentWithContract,
  ALL_CONTRACTS, MemoryTier,
} from "./runtime/index.js";
export type {
  AgentContract, GovContext, AgentEvent, AgentRunResult, AgentRunInput,
  AgentClass, RetryPolicy, FallbackPolicy, ValidationPolicy, EscalationPolicy,
} from "./runtime/index.js";

// Agent functions
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
