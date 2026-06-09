import { z } from "zod";
import type { ToolDefinition } from "./types.js";

const toolRegistry = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  toolRegistry.set(def.name, def);
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

export function checkToolAllowed(agentName: string, allowedTools: string[], toolName: string): boolean {
  if (toolName === "llm_gateway") return true; // All agents get LLM access
  return allowedTools.includes(toolName);
}

export function listTools(): ToolDefinition[] {
  return Array.from(toolRegistry.values());
}
