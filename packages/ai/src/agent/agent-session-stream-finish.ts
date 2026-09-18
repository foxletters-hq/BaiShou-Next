import { isAgentStreamAbortError, isAgentGateRejectedError, logger } from '@baishou/shared'
import {
  applyRejectedCompanionAskResults,
  shouldReportAgentStreamAsError
} from './companion-ask-reject.util'
import { persistResult } from './agent-session-persist'
import { shouldPersistPartialAssistantAfterStop } from './persist-aborted-assistant.util'
import { isAgentStreamSessionClaimActive } from './stream-session-guard'
import { ContextCompressorService } from './context-compressor.service'
import { isNoOutputGeneratedError } from './no-output-generated-error.util'
import type { StreamAccumulator } from './stream-accumulator'
import type { StreamingAssistantCheckpoint } from './streaming-assistant-checkpoint'
import type { StreamChatCallbacks, StreamChatOptions } from './agent-session.types'
import type { AgentSessionRuntimeRecorder } from './session-runtime-event'
import type { BaishouAgentGateSessionBuffer } from '../baishou-agent-gate/baishou-agent-gate-session-buffer'
import type { WorkspaceSessionBuffer } from '../agent-workspace/workspace-session-buffer'

export async function finishAgentSessionStream(input: {
  options: StreamChatOptions
  callbacks?: StreamChatCallbacks
  streamResult: any
  streamError: unknown
  accumulator: StreamAccumulator
  assistantCheckpoint: StreamingAssistantCheckpoint
  doomTripped: boolean
  dbHistory: any[]
  builtSystemPrompt: string
  mergedUserConfig: Record<string, unknown>
  gateSessionBuffer: BaishouAgentGateSessionBuffer
  workspaceSessionBuffer: WorkspaceSessionBuffer
  runtimeRecorder: AgentSessionRuntimeRecorder
  recordRuntimeInterrupted: (reason: string) => void
}): Promise<void> {
  const {
    options,
    callbacks,
    streamResult,
    accumulator,
    assistantCheckpoint,
    doomTripped,
    dbHistory,
    builtSystemPrompt,
    mergedUserConfig,
    gateSessionBuffer,
    workspaceSessionBuffer,
    runtimeRecorder,
    recordRuntimeInterrupted
  } = input
  let { streamError } = input
  const {
    sessionId,
    userText,
    sessionRepo,
    snapshotRepo,
    provider,
    modelId,
    skipUserMessageRecording,
    userMessageId,
    streamClaimGeneration,
    flushSessionToDisk,
    systemModels,
    abortSignal
  } = options

  const streamAborted = Boolean(abortSignal?.aborted) || isAgentStreamAbortError(streamError)
  const userAborted = streamAborted && !doomTripped

  if (isNoOutputGeneratedError(streamError)) {
    streamError = null
  }

  const hasModelOutput =
    Boolean(accumulator.sanitizedText.trim()) ||
    Boolean(accumulator.reasoning.trim()) ||
    accumulator.toolCalls.length > 0 ||
    gateSessionBuffer.buildPartDataList().length > 0 ||
    workspaceSessionBuffer.buildPartDataList().length > 0

  if (doomTripped) {
    streamError = new Error('检测到工具调用死循环，已中断本轮')
  } else if (userAborted) {
    streamError = isAgentStreamAbortError(streamError)
      ? streamError
      : new DOMException('The operation was aborted', 'AbortError')
  } else if (!streamError && !hasModelOutput) {
    streamError = new Error('模型未返回任何内容，请检查附件格式或稍后重试')
  }

  if (isAgentGateRejectedError(streamError)) {
    applyRejectedCompanionAskResults(accumulator.timeline)
  }

  if (streamError && !userAborted && !doomTripped && shouldReportAgentStreamAsError(streamError)) {
    logger.warn(
      '[AgentSessionService] Stream encountered a fatal error:',
      streamError instanceof Error ? streamError.message : String(streamError)
    )
  }

  if (
    streamClaimGeneration !== undefined &&
    !isAgentStreamSessionClaimActive(sessionId, streamClaimGeneration)
  ) {
    logger.info(`[AgentSessionService] Skip persist for session ${sessionId}: stream superseded`)
    recordRuntimeInterrupted('superseded')
    await assistantCheckpoint.discard()
    return
  }

  if (doomTripped) {
    logger.info(`[AgentSessionService] Skip persist for session ${sessionId}: doom-loop`)
    const doomErr =
      streamError instanceof Error ? streamError : new Error('检测到工具调用死循环，已中断本轮')
    runtimeRecorder.record({
      type: 'session.stream_finished',
      sessionId,
      success: false,
      error: doomErr.message,
      timestamp: Date.now()
    })
    callbacks?.onError?.(doomErr)
    await assistantCheckpoint.discard()
    return
  }

  if (
    userAborted &&
    !shouldPersistPartialAssistantAfterStop({
      userAborted: true,
      doomTripped: false,
      superseded: false,
      hasModelOutput
    })
  ) {
    logger.info(
      `[AgentSessionService] Skip persist for session ${sessionId}: user aborted with no output`
    )
    await assistantCheckpoint.discard()
    callbacks?.onFinish?.({
      messageId: undefined,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      costMicros: 0
    })
    return
  }

  const existingAssistantMessageId = (await assistantCheckpoint.drain()) ?? undefined
  const usageResult = await persistResult({
    sessionId,
    rawUserText: userText,
    streamResult,
    accumulator,
    sessionRepo,
    snapshotRepo,
    provider,
    modelId,
    skipUserMessageRecording,
    userMessageId,
    streamError,
    dbHistory,
    systemPrompt: builtSystemPrompt,
    namingModelConfigured: systemModels?.namingModelConfigured,
    namingProvider: systemModels?.namingProvider,
    namingModelId: systemModels?.namingModelId,
    namingReasoningEffort: systemModels?.namingReasoningEffort,
    flushSessionToDisk,
    userConfig: mergedUserConfig,
    agentGateParts: gateSessionBuffer.buildPartDataList(),
    fileChangeParts: workspaceSessionBuffer.buildPartDataList(),
    existingAssistantMessageId
  })

  if (!streamError && accumulator.toolCalls.length > 0) {
    await ContextCompressorService.runPrune(sessionRepo, sessionId, undefined, {
      flushSessionToDisk
    })
  }

  if (streamError && shouldReportAgentStreamAsError(streamError) && !abortSignal?.aborted) {
    const errObj = streamError instanceof Error ? streamError : new Error(String(streamError))
    runtimeRecorder.record({
      type: 'session.stream_finished',
      sessionId,
      success: false,
      error: errObj.message,
      timestamp: Date.now()
    })
    callbacks?.onError?.(errObj)
  } else if (!streamError || userAborted || !shouldReportAgentStreamAsError(streamError)) {
    runtimeRecorder.record({
      type: 'session.stream_finished',
      sessionId,
      success: true,
      messageId: usageResult.assistantMessageId,
      usage: {
        inputTokens: usageResult.inputTokens,
        outputTokens: usageResult.outputTokens,
        cacheReadInputTokens: usageResult.cacheReadInputTokens,
        cacheWriteInputTokens: usageResult.cacheWriteInputTokens
      },
      timestamp: Date.now()
    })
    callbacks?.onFinish?.({
      messageId: usageResult.assistantMessageId,
      inputTokens: usageResult.inputTokens,
      outputTokens: usageResult.outputTokens,
      cacheReadInputTokens: usageResult.cacheReadInputTokens,
      cacheWriteInputTokens: usageResult.cacheWriteInputTokens,
      costMicros: usageResult.costMicros
    })
  }
}
