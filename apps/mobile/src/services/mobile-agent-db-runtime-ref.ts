import type { AgentDbRuntime } from './mobile-agent-db-runtime'

/** 与 BaishouProvider 同步的 Agent DB 运行时引用，供自愈 retry 获取最新 repo/service */
export const agentDbRuntimeRef: { current: AgentDbRuntime | null } = { current: null }

export function getAgentDbRuntime(): AgentDbRuntime | null {
  return agentDbRuntimeRef.current
}
