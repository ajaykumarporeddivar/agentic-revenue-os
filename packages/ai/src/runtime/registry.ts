import type { AgentContract } from "./types.js";

const registry = new Map<string, AgentContract>();

export function registerAgent(contract: AgentContract): void {
  if (registry.has(contract.agent_name)) {
    throw new Error(
      `Agent "${contract.agent_name}" already registered. ` +
      `Use registerAgent to replace by bumping version first.`,
    );
  }
  registry.set(contract.agent_name, contract);
}

export function getContract(agentName: string): AgentContract | undefined {
  return registry.get(agentName);
}

export function listAgents(): AgentContract[] {
  return Array.from(registry.values());
}

export function getContractsByClass(agentClass: string): AgentContract[] {
  return Array.from(registry.values()).filter(a => a.agent_class === agentClass);
}
