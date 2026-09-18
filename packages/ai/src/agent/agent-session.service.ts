import {
  isVisionModel,
  logger,
  isAgentStreamAbortError,
  normalizeReasoningEffortSetting,
  type ReasoningEffortSetting
} from '@baishou/shared'
import { buildDefaultReasoningOptions } from '../providers/reasoning'
import { StreamChatOptions, StreamChatCallbacks } from './agent-session.types'
import { messageHasImageAttachments } from './attachment-content.builder'
import { resolveSessionAgentGate } from '../baishou-agent-gate/baishou-agent-gate-session.util'
import { BaishouAgentGateSessionBuffer } from '../baishou-agent-gate/baishou-agent-gate-session-buffer'
import { WorkspaceSessionBuffer } from '../agent-workspace/workspace-session-buffer'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import { onAgentGateLifecycle } from './agent-gate-lifecycle'
import { AgentSessionRuntimeRecorder } from './session-runtime-event'
import { resolveSessionRuntimeProfile } from '../session-runtime'
import { prepareAgentSessionContext } from './agent-session-context'
import { buildAgentSessionToolsAndPrompt } from './agent-session-tools'
import { runAgentSessionStream } from './agent-session-stream-run'
import { finishAgentSessionStream } from './agent-session-stream-finish'

export type { StreamChatOptions, StreamChatCallbacks } from './agent-session.types'

export class AgentSessionService {
  /**
   * 开启一个流式聊天会话。
   * 此方法会自动从数据库汇聚历史，并使用流式 SDK 发起调用。
   * 它的主要职责是拦截状态并驱动 StreamAccumulator，最后完成事务落盘。
   */
  async streamChat(options: StreamChatOptions, callbacks?: StreamChatCallbacks): Promise<void> {
    const {
      sessionId,
      provider,
      modelId,
      userConfig,
      attachments,
      abortSignal,
      agentGate: injectedAgentGate,
      persistBaishouAgentGateConfig,
      workspace: workspaceInput,
      maxSteps: maxStepsOption,
      sessionRuntimeV2: sessionRuntimeV2Option
    } = options

    let sessionAgentGate: IBaishouAgentGate | undefined
    const gateSessionBuffer = new BaishouAgentGateSessionBuffer()
    const workspaceSessionBuffer = new WorkspaceSessionBuffer()
    const workspaceOptions = workspaceInput
      ? {
          ...workspaceInput,
          onFileChange: (change: import('@baishou/shared').FileChangePartData) => {
            workspaceSessionBuffer.push(change)
            workspaceInput.onFileChange?.(change)
          }
        }
      : undefined
    const runtimeProfile = resolveSessionRuntimeProfile({
      sessionKind: workspaceOptions?.sessionKind,
      userConfig,
      options: {
        sessionRuntimeV2: sessionRuntimeV2Option,
        maxSteps: maxStepsOption
      }
    })
    const enableRuntimeV2 = runtimeProfile.sessionRuntimeV2 === true
    const effectiveMaxSteps = runtimeProfile.maxSteps ?? 10
    const interruptOnGateReject = runtimeProfile.interruptOnGateReject === true
    const doomLoopThreshold = runtimeProfile.doomLoopThreshold ?? 3
    const unsubGateBuffer = onAgentGateLifecycle((event) => {
      if (event.type === 'agent_gate.allowlist_changed') return
      if (event.type === 'agent_gate.asked' && event.request.sessionId !== sessionId) return
      if (event.type === 'agent_gate.replied' && event.sessionId !== sessionId) return
      gateSessionBuffer.handleEvent(event)
    })
    const onAbortCancelGate = () => {
      sessionAgentGate?.cancelSession(sessionId, 'stream aborted')
    }
    abortSignal?.addEventListener('abort', onAbortCancelGate, { once: true })

    const runtimeRecorder = new AgentSessionRuntimeRecorder()
    let runtimeInterruptedRecorded = false
    const recordRuntimeInterrupted = (reason: string) => {
      if (runtimeInterruptedRecorded) return
      runtimeInterruptedRecorded = true
      runtimeRecorder.record({
        type: 'session.interrupted',
        sessionId,
        reason,
        timestamp: Date.now()
      })
    }
    const onAbortRuntime = () => recordRuntimeInterrupted('aborted')
    abortSignal?.addEventListener('abort', onAbortRuntime, { once: true })

    try {
      const { gate: sessionAgentGateResolved } = resolveSessionAgentGate({
        agentGate: injectedAgentGate,
        userConfig,
        persistBaishouAgentGateConfig
      })
      sessionAgentGate = sessionAgentGateResolved

      const prepared = await prepareAgentSessionContext({
        options,
        sessionAgentGate,
        workspaceOptions
      })

      const { enabledTools, builtSystemPrompt } = await buildAgentSessionToolsAndPrompt({
        options,
        sessionAgentGate,
        workspaceOptions,
        mergedUserConfig: prepared.mergedUserConfig,
        effectiveSystemPrompt: prepared.effectiveSystemPrompt,
        assistantKind: prepared.assistantKind,
        injectMessageTime: prepared.injectMessageTime,
        configRecentCount: prepared.configRecentCount,
        vaultId: prepared.vaultId,
        vaultName: prepared.vaultName,
        saveDiaryBeforeCompression: prepared.saveDiaryBeforeCompression,
        interruptOnGateReject
      })

      if (
        attachments?.length &&
        messageHasImageAttachments(attachments) &&
        !isVisionModel(modelId, provider.config?.id ?? provider.config?.type)
      ) {
        throw new Error('VISION_NOT_SUPPORTED')
      }

      const lastUserMsg = [...prepared.messagesForModel].reverse().find((m) => m.role === 'user')
      if (lastUserMsg) {
        const content = lastUserMsg.content
        const isEmptyUserContent =
          content === '' ||
          (Array.isArray(content) && content.length === 0) ||
          (Array.isArray(content) &&
            content.every(
              (part) =>
                typeof part === 'object' &&
                part !== null &&
                'type' in part &&
                (part as { type?: string; text?: string }).type === 'text' &&
                !(part as { text?: string }).text?.trim()
            ))
        if (isEmptyUserContent) {
          throw new Error('无法发送：用户消息内容为空（附件可能未能正确读取）')
        }
      }

      runtimeRecorder.record({
        type: 'session.prompt_admitted',
        sessionId,
        userMessageId: options.userMessageId,
        sessionKind: workspaceOptions?.sessionKind,
        timestamp: Date.now()
      })

      const cachingCtx = {
        providerType: prepared.effectiveProviderType,
        providerId: provider.config?.id,
        modelId,
        sessionId,
        baseUrl: provider.config?.baseUrl
      }

      const reasoningEffortSetting = normalizeReasoningEffortSetting(
        prepared.mergedUserConfig?.['reasoningEffort'] ??
          prepared.mergedUserConfig?.['reasoningEffortDefault']
      ) as ReasoningEffortSetting
      const budgetRaw = prepared.mergedUserConfig?.['reasoningBudgetTokens']
      const budgetTokens =
        typeof budgetRaw === 'number'
          ? budgetRaw
          : typeof budgetRaw === 'string' && budgetRaw.trim()
            ? Number(budgetRaw)
            : undefined
      const builtReasoning = buildDefaultReasoningOptions({
        modelId,
        providerType: prepared.effectiveProviderType,
        baseUrl: provider.config?.baseUrl,
        effort: reasoningEffortSetting,
        budgetTokens,
        hasTools: Boolean(enabledTools && Object.keys(enabledTools).length > 0)
      })

      const streamed = await runAgentSessionStream({
        options,
        callbacks,
        model: prepared.model,
        messagesForModel: prepared.messagesForModel as any[],
        builtSystemPrompt,
        enabledTools,
        builtReasoning,
        cachingCtx,
        enableRuntimeV2,
        effectiveMaxSteps,
        doomLoopThreshold,
        sessionId,
        mergedUserConfig: prepared.mergedUserConfig,
        gateSessionBuffer,
        workspaceSessionBuffer,
        runtimeRecorder,
        recordRuntimeInterrupted
      })

      await finishAgentSessionStream({
        options,
        callbacks,
        streamResult: streamed.streamResult,
        streamError: streamed.streamError,
        accumulator: streamed.accumulator,
        assistantCheckpoint: streamed.assistantCheckpoint,
        doomTripped: streamed.doomTripped,
        dbHistory: prepared.dbHistory,
        builtSystemPrompt,
        mergedUserConfig: prepared.mergedUserConfig,
        gateSessionBuffer,
        workspaceSessionBuffer,
        runtimeRecorder,
        recordRuntimeInterrupted
      })
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      const aborted = isAgentStreamAbortError(err) || abortSignal?.aborted === true
      if (!aborted) {
        runtimeRecorder.record({
          type: 'session.stream_finished',
          sessionId,
          success: false,
          error: err.message,
          timestamp: Date.now()
        })
      }
      if (!aborted) {
        logger.error('[AgentSessionService] Error in streamChat:', err.message)
        if (err.stack) {
          logger.error('[AgentSessionService] Stack:', err.stack)
        }
      }
      if (!aborted && (e as { cause?: unknown })?.cause) {
        logger.error('[AgentSessionService] Cause:', {
          cause: String((e as { cause?: unknown }).cause)
        })
      }
      if ((e as { url?: string })?.url) {
        logger.error('[AgentSessionService] Failing URL:', (e as { url?: string }).url)
      }
      if ((e as { statusCode?: number })?.statusCode) {
        logger.error(
          '[AgentSessionService] HTTP status:',
          (e as { statusCode?: number }).statusCode
        )
      }
      if (!aborted && (e as { responseHeaders?: unknown })?.responseHeaders) {
        logger.error(
          '[AgentSessionService] Response headers:',
          JSON.stringify((e as { responseHeaders?: unknown }).responseHeaders)
        )
      }
      if (!aborted) {
        callbacks?.onError?.(err)
      }
      throw aborted ? new DOMException('The operation was aborted', 'AbortError') : err
    } finally {
      unsubGateBuffer()
      abortSignal?.removeEventListener('abort', onAbortCancelGate)
      abortSignal?.removeEventListener('abort', onAbortRuntime)
      sessionAgentGate?.cancelSession(sessionId, 'stream ended')
    }
  }
}
