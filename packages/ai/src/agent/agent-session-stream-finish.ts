import {
  createAgentStreamAbortError,
  createProviderContentFilterError,
  isAgentStreamAbortError,
  isAgentGateRejectedError,
  isContentFilterFinishReason,
  logger,
  readProviderContentFilterDetail
} from '@baishou/shared'
import { isAgentFirstOutputTimeoutError, isAgentStreamUserAborted } from './agent-stream-timeout'
import {
  UNEXPECTED_AGENT_STREAM_ABORT_MESSAGE,
  applyFailedIncompleteToolResults,
  applyRejectedCompanionAskResults,
  shouldReportAgentStreamAsError
} from './companion-ask-reject.util'
import { persistResult } from './agent-session-persist'
import { shouldPersistPartialAssistantAfterStop } from './persist-aborted-assistant.util'
import { isAgentStreamSessionClaimActive } from './stream-session-guard'
import { ContextCompressorService } from './context-compressor.service'
import { isNoOutputGeneratedError } from './no-output-generated-error.util'
import { normalizeApiErrorObject } from '../providers/provider-api-error.util'
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

  const userAborted = isAgentStreamUserAborted({
    streamError,
    abortSignalAborted: Boolean(abortSignal?.aborted),
    doomTripped
  })

  if (isNoOutputGeneratedError(streamError)) {
    streamError = null
  }

  const hasModelOutput =
    Boolean(accumulator.sanitizedText.trim()) ||
    Boolean(accumulator.reasoning.trim()) ||
    accumulator.toolCalls.length > 0 ||
    gateSessionBuffer.buildPartDataList().length > 0 ||
    workspaceSessionBuffer.buildPartDataList().length > 0

  const accumulatorMeta = accumulator as StreamAccumulator & {
    finishReason?: string | null
    rawFinishReason?: string | null
    providerFinishMessage?: string | null
    promptBlockReason?: string | null
  }
  const blockedByContentFilter =
    isContentFilterFinishReason(accumulatorMeta.finishReason, accumulatorMeta.rawFinishReason) ||
    Boolean(accumulatorMeta.promptBlockReason)

  if (userAborted) {
    streamError = isAgentStreamAbortError(streamError) ? streamError : createAgentStreamAbortError()
  } else if (streamError && !isAgentStreamAbortError(streamError)) {
    streamError = normalizeApiErrorObject(streamError)
  } else if (!streamError && blockedByContentFilter) {
    const filterDetail = [
      accumulatorMeta.promptBlockReason
        ? `promptBlockReason=${accumulatorMeta.promptBlockReason}`
        : '',
      accumulatorMeta.finishReason ? `finishReason=${accumulatorMeta.finishReason}` : '',
      accumulatorMeta.rawFinishReason ? `rawFinishReason=${accumulatorMeta.rawFinishReason}` : '',
      accumulatorMeta.providerFinishMessage
        ? `finishMessage=${accumulatorMeta.providerFinishMessage}`
        : ''
    ]
      .filter(Boolean)
      .join(', ')
    streamError = createProviderContentFilterError(filterDetail)
  } else if (!streamError && !hasModelOutput) {
    streamError = new Error(
      options.attachments?.length
        ? '模型未返回任何内容，请检查附件格式或稍后重试'
        : '模型未返回任何内容，可能是服务商暂时无响应或内容被过滤，请稍后重试'
    )
  }

  if (isAgentGateRejectedError(streamError) || userAborted) {
    applyRejectedCompanionAskResults(accumulator.timeline)
  } else if (streamError && shouldReportAgentStreamAsError(streamError, { userAborted })) {
    const failMessage =
      isAgentStreamAbortError(streamError) && !userAborted
        ? UNEXPECTED_AGENT_STREAM_ABORT_MESSAGE
        : streamError instanceof Error
          ? streamError.message
          : String(streamError)
    applyFailedIncompleteToolResults(accumulator.timeline, failMessage)
    if (isAgentStreamAbortError(streamError) && !userAborted) {
      streamError = new Error(UNEXPECTED_AGENT_STREAM_ABORT_MESSAGE)
    }
  }

  if (streamError && !userAborted && shouldReportAgentStreamAsError(streamError, { userAborted })) {
    const detail = readProviderContentFilterDetail(streamError)
    const msg = streamError instanceof Error ? streamError.message : String(streamError)
    logger.warn(
      '[AgentSessionService] Stream encountered a fatal error:',
      detail ? `${msg} (${detail})` : msg
    )
  }

  if (
    streamClaimGeneration !== undefined &&
    !isAgentStreamSessionClaimActive(sessionId, streamClaimGeneration)
  ) {
    recordRuntimeInterrupted('superseded')
    let shouldPreserveSupersededTurn = false
    if (hasModelOutput && userMessageId && typeof sessionRepo.getMessageById === 'function') {
      try {
        const parentUserMsg = await sessionRepo.getMessageById(userMessageId)
        if (parentUserMsg && typeof parentUserMsg.orderIndex === 'number') {
          const recentMessages = await sessionRepo.getMessagesBySession(sessionId, 50)
          const hasSubsequentUserTurn = recentMessages.some(
            (m: any) =>
              m.role === 'user' &&
              m.id !== userMessageId &&
              typeof m.orderIndex === 'number' &&
              m.orderIndex >= parentUserMsg.orderIndex
          )
          const hasExistingAssistantReply = recentMessages.some(
            (m: any) =>
              m.role === 'assistant' &&
              m.id !== assistantCheckpoint.assistantMessageId &&
              typeof m.orderIndex === 'number' &&
              m.orderIndex > parentUserMsg.orderIndex
          )
          shouldPreserveSupersededTurn = hasSubsequentUserTurn && !hasExistingAssistantReply
        }
      } catch {
        shouldPreserveSupersededTurn = false
      }
    }

    if (!shouldPreserveSupersededTurn) {
      logger.info(`[AgentSessionService] Skip persist for session ${sessionId}: stream superseded`)
      await assistantCheckpoint.discard()
      return
    }

    logger.info(
      `[AgentSessionService] Preserving completed/partial assistant output for session ${sessionId} before subsequent user turn`
    )
    const supersededAssistantMessageId = (await assistantCheckpoint.drain()) ?? undefined
    await persistResult({
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
      existingAssistantMessageId: supersededAssistantMessageId,
      userAborted: true
    })
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
    existingAssistantMessageId,
    userAborted
  })

  if (!streamError && accumulator.toolCalls.length > 0) {
    await ContextCompressorService.runPrune(sessionRepo, sessionId, undefined, {
      flushSessionToDisk
    })
  }

  if (
    streamError &&
    shouldReportAgentStreamAsError(streamError, { userAborted }) &&
    (!abortSignal?.aborted || isAgentFirstOutputTimeoutError(streamError))
  ) {
    const errObj = streamError instanceof Error ? streamError : new Error(String(streamError))
    runtimeRecorder.record({
      type: 'session.stream_finished',
      sessionId,
      success: false,
      error: errObj.message,
      timestamp: Date.now()
    })
    callbacks?.onError?.(errObj)
  } else if (
    !streamError ||
    userAborted ||
    !shouldReportAgentStreamAsError(streamError, { userAborted })
  ) {
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
