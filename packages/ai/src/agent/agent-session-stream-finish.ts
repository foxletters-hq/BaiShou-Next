import { isAgentStreamAbortError, isAgentGateRejectedError, logger } from '@baishou/shared'
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

  if (userAborted) {
    streamError = isAgentStreamAbortError(streamError)
      ? streamError
      : new DOMException('The operation was aborted', 'AbortError')
  } else if (!streamError && !hasModelOutput) {
    streamError = new Error('模型未返回任何内容，请检查附件格式或稍后重试')
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
