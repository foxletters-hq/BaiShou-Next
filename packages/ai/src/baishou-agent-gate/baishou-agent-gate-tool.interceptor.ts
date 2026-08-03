import {
  AgentGateKind,
  AgentGateProfileId,
  AgentGateCancelledError,
  AgentGateCorrectedError,
  AgentGateDeniedError,
  AgentGateRejectedError,
  extractAgentGateResourcesFromMetadata,
  mergeAgentGateResources,
  resolveAgentGateProfileId,
  type AgentGatePrepareResult,
  type AgentGateToolMetadata
} from '@baishou/shared'
import type { ToolContext } from '../tools/agent.tool'
import {
  WorkspaceGatePrepareError,
  WorkspaceGateStaleError
} from '../agent-workspace/workspace-gate-preview'
import {
  assertRegisteredWorkspaceGateFreshness,
  forgetWorkspaceGateFreshnessToken
} from '../agent-workspace/workspace-gate-freshness.registry'
import { createNodeWorkspaceFs } from '../agent-workspace/workspace-fs'
import { collectExternalDirectoryGlobs } from './agent-gate-workspace-path.util'

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

function resolveProfileFromContext(context: ToolContext): AgentGateProfileId {
  if (context.gateProfile) {
    return resolveAgentGateProfileId(context.gateProfile)
  }
  if (context.workspace?.sessionKind === 'workspace') {
    return AgentGateProfileId.Workspace
  }
  return AgentGateProfileId.Companion
}

function resolveScopeFromContext(context: ToolContext) {
  if (context.workspace?.sessionKind === 'workspace' && context.workspace.workspaceId) {
    return { kind: 'workspace' as const, workspaceId: context.workspace.workspaceId }
  }
  return { kind: 'companion' as const }
}

/**
 * Wraps a Vercel tool execute handler with BaishouAgentGate.assert() when metadata and gate are present.
 * Optional prepare() runs before assert; verifyBeforeExecute runs after approval, before execute.
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

    let prepared: AgentGatePrepareResult | null | undefined
    if (metadata.prepare) {
      try {
        prepared = await metadata.prepare(args, context)
      } catch (error) {
        if (error instanceof WorkspaceGatePrepareError) {
          return `Error: ${error.message}`
        }
        throw error
      }
      if (prepared === null) {
        // e.g. patch old_text not found — fail closed without asking
        return `Error: 无法生成预执行预览（内容不匹配或条件不满足），未请求授权。`
      }
    }

    const freshnessToken = prepared?.freshnessToken
    const releaseFreshness = () => forgetWorkspaceGateFreshnessToken(freshnessToken)

    const action = metadata.action ?? toolName
    const title = metadata.buildTitle?.(args, context) ?? defaultGateTitle(toolName)
    const builtMetadata = metadata.buildMetadata?.(args, context) ?? {}
    const resources = mergeAgentGateResources(
      metadata.buildResources?.(args, context),
      extractAgentGateResourcesFromMetadata(builtMetadata)
    )
    const alwaysPatterns = metadata.buildAlwaysPatterns?.(args, context)
    const gateMetadata = {
      toolName,
      riskLevel: metadata.riskLevel,
      ...(metadata.forceExclusion ? { forceExclusion: true } : {}),
      ...builtMetadata,
      ...(prepared?.metadataPatch ?? {}),
      ...(resources.length > 0 ? { resources } : {}),
      ...(alwaysPatterns ? { alwaysPatterns } : {})
    }

    const profileId = resolveProfileFromContext(context)
    const scope = resolveScopeFromContext(context)

    try {
      // G4.2：区外路径先过 external_directory 门，再过能力门
      if (action !== 'external_directory') {
        const externalGlobs = collectExternalDirectoryGlobs(resources)
        for (const glob of externalGlobs) {
          await gate.assert({
            sessionId: context.sessionId,
            vaultName: context.vaultName,
            kind: AgentGateKind.Tool,
            action: 'external_directory',
            title: `访问区外目录 ${glob.replace(/\/\*\*$/, '') || glob}`,
            description: `该操作触及工作区外路径，需先确认区外目录访问。`,
            allowCustomInput: true,
            profileId,
            scope,
            metadata: {
              toolName,
              riskLevel: metadata.riskLevel,
              externalDirectory: glob
            },
            resources: [{ kind: 'external_path', value: glob }]
          })
        }
      }

      await gate.assert({
        sessionId: context.sessionId,
        vaultName: context.vaultName,
        kind: AgentGateKind.Tool,
        action,
        title,
        description: prepared?.description,
        allowCustomInput: true,
        profileId,
        scope,
        preview: prepared?.preview,
        metadata: gateMetadata,
        resources: resources.length > 0 ? resources : undefined
      })
    } catch (error) {
      releaseFreshness()
      if (isAgentGateControlError(error)) {
        return error.message
      }
      throw error
    }

    if (prepared?.verifyBeforeExecute) {
      try {
        await prepared.verifyBeforeExecute()
      } catch (error) {
        releaseFreshness()
        if (error instanceof WorkspaceGateStaleError) {
          return `Error: ${error.message}`
        }
        throw error
      }
    }

    if (freshnessToken) {
      try {
        const fs = context.workspace?.fs ?? createNodeWorkspaceFs()
        await assertRegisteredWorkspaceGateFreshness({
          token: freshnessToken,
          fs,
          requireRegistration: true
        })
      } catch (error) {
        if (error instanceof WorkspaceGateStaleError) {
          return `Error: ${error.message}`
        }
        throw error
      }
    }

    return execute(args)
  }
}
