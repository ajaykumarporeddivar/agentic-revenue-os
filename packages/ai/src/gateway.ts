import { z } from "zod";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costCents: number;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.60 },   // $ per 1M tokens
  "gpt-4o": { input: 2.50, output: 10.00 },
  "claude-sonnet-4-20250514": { input: 3.00, output: 15.00 },
  "claude-haiku-3-5": { input: 0.80, output: 4.00 },
  "llama-3.3-70b": { input: 0.59, output: 0.79 },
  "mixtral-8x7b": { input: 0.24, output: 0.24 },
};

const DEFAULT_CONFIG: LLMConfig = {
  model: process.env.AI_MODEL ?? "gpt-4o-mini",
  temperature: 0.3,
  maxTokens: 4096,
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] ?? { input: 0.50, output: 1.50 };
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Math.ceil((inputCost + outputCost) * 100); // cents
}

async function callAnthropic(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required for Claude models");

  const systemMsg = messages.find(m => m.role === "system")?.content ?? "";
  const nonSystem = messages.filter(m => m.role !== "system").map(m => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      system: systemMsg,
      messages: nonSystem,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${errBody}`);
  }

  const data = await res.json() as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const content = data.content?.[0]?.text ?? "";
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;

  return {
    content,
    usage: {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens: inputTokens + outputTokens,
      costCents: estimateCost(config.model, inputTokens, outputTokens),
    },
  };
}

async function callOpenAI(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.AI_BASE_URL ?? "https://api.groq.com/openai/v1";
  if (!apiKey) throw new Error("GROQ_API_KEY or OPENAI_API_KEY required");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI-compatible API error ${res.status}: ${errBody}`);
  }

  const data = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const content = data.choices?.[0]?.message?.content ?? "";
  const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0 };

  return {
    content,
    usage: {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
      totalTokens: (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
      costCents: estimateCost(
        config.model,
        usage.prompt_tokens ?? 0,
        usage.completion_tokens ?? 0,
      ),
    },
  };
}

export async function callLLM(
  messages: LLMMessage[],
  config: Partial<LLMConfig> = {},
): Promise<LLMResponse> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const isClaude = cfg.model.startsWith("claude");

  if (isClaude) {
    return callAnthropic(messages, cfg);
  }
  return callOpenAI(messages, cfg);
}

export async function callLLMStructured<T extends z.ZodTypeAny>(
  messages: LLMMessage[],
  schema: T,
  config: Partial<LLMConfig> = {},
): Promise<{ data: z.output<T>; usage: LLMUsage }> {
  const cfg = { ...DEFAULT_CONFIG, temperature: 0.1, ...config };

  const systemMsg = messages.find(m => m.role === "system");
  const userMsgs = messages.filter(m => m.role !== "system");

  const schemaInstruction =
    `\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, no explanations. ` +
    `The JSON must match this exact schema: ${JSON.stringify(schema.description || schema._def?.description || "See schema")}`;

  const finalMessages: LLMMessage[] = [
    ...(systemMsg ? [{ role: "system" as const, content: systemMsg.content + schemaInstruction }] : []),
    ...userMsgs,
    { role: "user" as const, content: "Return valid JSON matching the required schema. No other text." },
  ];

  const response = await callLLM(finalMessages, cfg);

  let parsed: z.output<T>;
  try {
    // Strip any markdown code fences
    const cleaned = response.content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*$/g, "")
      .trim();

    const json = JSON.parse(cleaned);
    parsed = schema.parse(json);
  } catch (err) {
    throw new Error(
      `Failed to parse structured LLM output: ${err instanceof Error ? err.message : "unknown"}\n` +
      `Raw output: ${response.content.slice(0, 500)}`,
    );
  }

  return { data: parsed, usage: response.usage };
}
