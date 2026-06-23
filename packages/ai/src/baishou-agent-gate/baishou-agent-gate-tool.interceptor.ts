import {
  AgentGateKind,
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateDeniedError,
  AgentGateRejectedError,
  type AgentGateToolMetadata
} from '@baishou/shared'
import type { ToolContext } from '../tools/agent.tool'

function isAgentGateControlError(error: unknown): error is Error {
  return (
    error instanceof AgentGateDeniedError ||
    error instanceof AgentGateRejectedError ||
    error instanceof AgentGateCorrectedError ||
    error instanceof AgentGateCancelledError
  )
}

function defaultGateTitle(toolName: string): string {
  return `执行工具 ${toolName}`
}

/**
 * Wraps a Vercel tool execute handler with BaishouAgentGate.assert() when metadata and gate are present.
 */
export function wrapVercelToolExecuteWithAgentGate<TArgs>(
  toolName: string,
  metadata: AgentGateToolMetadata | undefined,
  context: ToolContext,
  execute: (args: TArgs) => Promise<string>
): (args: TArgs) => Promise<string> {
  return async (args: TArgs) => {
    const gate = context.agentGate
    if (!gate || !metadata) {
      return execute(args)
    }

    const action = metadata.action ?? toolName
    const title = metadata.buildTitle?.(args, context) ?? defaultGateTitle(toolName)
    const gateMetadata = {
      toolName,
      riskLevel: metadata.riskLevel,
      ...(metadata.buildMetadata?.(args, context) ?? {})
    }

    try {
      await gate.assert({
        sessionId: context.sessionId,
        vaultName: context.vaultName,
        kind: AgentGateKind.Tool,
        action,
        title,
        metadata: gateMetadata
      })
    } catch (error) {
      if (isAgentGateControlError(error)) {
        return error.message
      }
      throw error
    }

    return execute(args)
  }
}
