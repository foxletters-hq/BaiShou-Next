import { streamText, smoothStream, stepCountIs } from 'ai'
import { buildCachedSystemForStream } from '../middleware/middleware-factory'
import { StreamAccumulator } from './stream-accumulator'
import { StreamChunkAdapter } from './stream-chunk.adapter'
import { ChunkType } from './stream-chunk.types'
import { StreamingAssistantCheckpoint } from './streaming-assistant-checkpoint'
import { flushReasonFromStreamChunk } from './streaming-assistant-flush.util'
import { abortAgentStreamSession } from './stream-session-guard'
import { buildToolCallRepairHandler } from './tool-call-repair.util'
import {
  runWithOpenAiThinkingInjectAsync,
  type OpenAiThinkingBodyInject
} from '../providers/reasoning/openai-thinking-inject'
import { prepareSystemPromptWithEpoch } from '../session-runtime/context-epoch'
import { attachDoomLoopObserver } from '../session-runtime'
import {
  emitTurnFinished,
  emitTurnStarted,
  needsProviderTurnContinuation
} from '../session-runtime/turn'
import { readProviderTurnMessages } from '../session-runtime/read-provider-turn-messages'
import { isNoOutputGeneratedError } from './no-output-generated-error.util'
import { isAgentStreamAbortError, logger } from '@baishou/shared'
import {
  AgentSessionRuntimeRecorder,
  bridgeStreamChunkToRuntimeEvents,
  createSessionRuntimeBridgeState
} from './session-runtime-event'
import { dispatchChunkToCallbacks } from './agent-session-chunk-dispatch'
import type { StreamChatCallbacks } from './agent-session.types'
import type { BaishouAgentGateSessionBuffer } from '../baishou-agent-gate/baishou-agent-gate-session-buffer'
import type { WorkspaceSessionBuffer } from '../agent-workspace/workspace-session-buffer'
import type { StreamChatOptions } from './agent-session.types'

export async function runAgentSessionStream(input: {
  options: StreamChatOptions
  callbacks?: StreamChatCallbacks
  model: any
  messagesForModel: any[]
  builtSystemPrompt: string
  enabledTools: Record<string, unknown>
  builtReasoning: {
    openAiThinkingInject?: OpenAiThinkingBodyInject
    providerOptions?: unknown
  }
  cachingCtx: {
    providerType: string
    providerId?: string
    modelId: string
    sessionId: string
    baseUrl?: string
  }
  enableRuntimeV2: boolean
  effectiveMaxSteps: number
  doomLoopThreshold: number
  sessionId: string
  mergedUserConfig: Record<string, unknown>
  gateSessionBuffer: BaishouAgentGateSessionBuffer
  workspaceSessionBuffer: WorkspaceSessionBuffer
  runtimeRecorder: AgentSessionRuntimeRecorder
  recordRuntimeInterrupted: (reason: string) => void
}): Promise<{
  streamResult: any
  streamError: unknown
  accumulator: StreamAccumulator
  assistantCheckpoint: StreamingAssistantCheckpoint
  doomTripped: boolean
}> {
  const {
    options,
    callbacks,
    model,
    messagesForModel,
    builtSystemPrompt,
    enabledTools,
    builtReasoning,
    cachingCtx,
    enableRuntimeV2,
    effectiveMaxSteps,
    doomLoopThreshold,
    sessionId,
    mergedUserConfig,
    gateSessionBuffer,
    workspaceSessionBuffer,
    runtimeRecorder,
    recordRuntimeInterrupted
  } = input
  const { sessionRepo, userMessageId, skipUserMessageRecording, abortSignal, provider, modelId } =
    options

  const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined'
  const cjkSegmenter = hasSegmenter
    ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
    : undefined

  let systemForModel = ''
  if (!enableRuntimeV2) {
    systemForModel = prepareSystemPromptWithEpoch({
      sessionId,
      fullSystemPrompt: builtSystemPrompt
    }).systemPrompt
  }

  const accumulator = new StreamAccumulator()
  const assistantCheckpoint = new StreamingAssistantCheckpoint({
    sessionId,
    sessionRepo,
    userMessageId,
    skipUserMessageRecording,
    providerId: provider.config?.id ?? 'unknown',
    modelId,
    getSnapshot: () => ({
      accumulator,
      agentGateParts: gateSessionBuffer.buildPartDataList(),
      fileChangeParts: workspaceSessionBuffer.buildPartDataList(),
      userConfig: mergedUserConfig as Record<string, unknown>
    })
  })
  let doomTripped = false
  const doomObserver = attachDoomLoopObserver({
    sessionId,
    threshold: doomLoopThreshold,
    onTripped: () => {
      doomTripped = true
      abortAgentStreamSession(sessionId)
    }
  })
  let lastFinishReason = 'unknown'
  let turnToolCalls = 0
  const runtimeBridgeState = createSessionRuntimeBridgeState()

  const adapter = new StreamChunkAdapter(accumulator, {
    onChunk: (chunk) => {
      if (chunk.type === ChunkType.TOOL_CALL) {
        turnToolCalls += 1
        doomObserver.observe(chunk.toolName, chunk.input)
      }
      if (chunk.type === ChunkType.STEP_FINISH) {
        lastFinishReason = chunk.finishReason || lastFinishReason
      }
      dispatchChunkToCallbacks(chunk, callbacks)
      const runtimeEvents = bridgeStreamChunkToRuntimeEvents(sessionId, chunk, runtimeBridgeState)
      for (const event of runtimeEvents) {
        if (event.type === 'session.interrupted') {
          recordRuntimeInterrupted(event.reason)
        } else {
          runtimeRecorder.record(event)
        }
      }
      const flushReason = flushReasonFromStreamChunk(chunk.type)
      if (flushReason) assistantCheckpoint.schedule(flushReason)
    }
  })

  const runOneStream = async (
    messages: typeof messagesForModel,
    maxStepsThisTurn: number,
    systemPromptThisTurn: string
  ) =>
    runWithOpenAiThinkingInjectAsync(builtReasoning.openAiThinkingInject, async () =>
      streamText({
        model,
        messages,
        system: buildCachedSystemForStream(systemPromptThisTurn, cachingCtx as any),
        allowSystemInMessages: true,
        tools: enabledTools,
        stopWhen: stepCountIs(maxStepsThisTurn),
        abortSignal,
        experimental_repairToolCall: buildToolCallRepairHandler(),
        ...(builtReasoning.providerOptions
          ? { providerOptions: builtReasoning.providerOptions }
          : {}),
        ...(hasSegmenter && cjkSegmenter
          ? { experimental_transform: smoothStream({ chunking: cjkSegmenter }) }
          : {})
      } as any)
    )

  let streamResult: Awaited<ReturnType<typeof runOneStream>>
  let streamError: unknown = null

  if (enableRuntimeV2) {
    let turnMessages = [...messagesForModel] as any[]
    streamResult = undefined as any
    for (let turnIndex = 0; turnIndex < effectiveMaxSteps; turnIndex++) {
      if (abortSignal?.aborted || doomTripped) break
      const turned = prepareSystemPromptWithEpoch({
        sessionId,
        fullSystemPrompt: builtSystemPrompt
      })
      systemForModel = turned.systemPrompt
      emitTurnStarted(sessionId, turnIndex)
      turnToolCalls = 0
      lastFinishReason = 'unknown'
      const turnStream = await runOneStream(turnMessages, 1, turned.systemPrompt)
      streamResult = turnStream
      const consumed = await adapter.consumeStream(turnStream)
      if (consumed.error && !isNoOutputGeneratedError(consumed.error)) {
        streamError = consumed.error
      }
      const continueNeeded = needsProviderTurnContinuation({
        finishReason: lastFinishReason,
        hadToolCalls: turnToolCalls > 0,
        turnIndex,
        maxSteps: effectiveMaxSteps,
        aborted: Boolean(abortSignal?.aborted) || isAgentStreamAbortError(streamError),
        doomLoopTripped: doomTripped,
        singleStepTurn: true
      })
      emitTurnFinished(sessionId, turnIndex, {
        finishReason: lastFinishReason,
        needsContinuation: continueNeeded
      })
      if (!continueNeeded || doomTripped || abortSignal?.aborted || streamError) break
      try {
        const nextMessages = await readProviderTurnMessages(turnStream)
        if (nextMessages) {
          turnMessages.push(...(nextMessages as any[]))
        } else {
          break
        }
      } catch {
        break
      }
    }
    if (!streamResult) {
      if (!systemForModel) {
        systemForModel = prepareSystemPromptWithEpoch({
          sessionId,
          fullSystemPrompt: builtSystemPrompt
        }).systemPrompt
      }
      streamResult = await runOneStream(messagesForModel, 1, systemForModel)
      streamError = (await adapter.consumeStream(streamResult)).error
    }
  } else {
    streamResult = await runOneStream(messagesForModel, effectiveMaxSteps, systemForModel)
    streamError = (await adapter.consumeStream(streamResult)).error
  }

  const metrics = adapter.getMetrics()
  logger.info(
    `[AgentSessionService] 性能指标: TTFT=${metrics.timeToFirstToken}ms, 总耗时=${metrics.totalDuration}ms, 速度=${metrics.tokensPerSecond} tok/s`
  )

  return { streamResult, streamError, accumulator, assistantCheckpoint, doomTripped }
}
