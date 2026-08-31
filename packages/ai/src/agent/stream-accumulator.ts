import { logger, sanitizeAssistantGeneratedText } from '@baishou/shared'

export interface ToolCallSnapshot {
  callId: string
  name: string
  arguments: string
}

export interface ToolResultSnapshot {
  callId: string
  result: unknown
}

export interface StreamTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
}

/** 流式时间线片段：按发生顺序保留 reasoning / tool / text */
export type StreamTimelineItem =
  | { kind: 'reasoning'; text: string }
  | { kind: 'text'; text: string }
  | {
      kind: 'tool'
      callId: string
      name: string
      arguments: string
      result?: unknown
      status: 'running' | 'completed' | 'failed'
    }

function readNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function extractCacheUsageFromRecord(
  usage: Record<string, unknown> | undefined,
  metadata: Record<string, unknown> | undefined
): Pick<StreamTokenUsage, 'cacheReadInputTokens' | 'cacheWriteInputTokens'> {
  const anthropic = metadata?.anthropic as Record<string, unknown> | undefined
  const vertex = metadata?.vertex as Record<string, unknown> | undefined
  const bedrock = metadata?.bedrock as Record<string, unknown> | undefined
  const bedrockUsage = bedrock?.usage as Record<string, unknown> | undefined
  const openai = metadata?.openai as Record<string, unknown> | undefined
  const google = metadata?.google as Record<string, unknown> | undefined

  const cacheReadInputTokens = readNumber(
    usage?.cacheReadInputTokens ??
      usage?.cachedInputTokens ??
      usage?.prompt_cache_hit_tokens ??
      usage?.promptCacheHitTokens ??
      (usage?.promptTokensDetails as Record<string, unknown> | undefined)?.cachedTokens ??
      (usage?.promptTokensDetails as Record<string, unknown> | undefined)?.cached_tokens ??
      (usage?.inputTokensDetails as Record<string, unknown> | undefined)?.cachedTokens ??
      anthropic?.cacheReadInputTokens ??
      anthropic?.cache_read_input_tokens ??
      vertex?.cacheReadInputTokens ??
      bedrockUsage?.cacheReadInputTokens ??
      openai?.cachedPromptTokens ??
      google?.cachedContentTokenCount
  )

  const cacheWriteInputTokens = readNumber(
    usage?.cacheWriteInputTokens ??
      usage?.cacheCreationInputTokens ??
      anthropic?.cacheCreationInputTokens ??
      anthropic?.cache_creation_input_tokens ??
      vertex?.cacheCreationInputTokens ??
      bedrockUsage?.cacheWriteInputTokens
  )

  return { cacheReadInputTokens, cacheWriteInputTokens }
}

export class StreamAccumulator {
  private _timeline: StreamTimelineItem[] = []

  private _inputTokens: number = 0
  private _outputTokens: number = 0
  private _cacheReadInputTokens: number = 0
  private _cacheWriteInputTokens: number = 0

  get timeline(): readonly StreamTimelineItem[] {
    return this._timeline
  }

  get text(): string {
    return this._timeline
      .filter((item): item is Extract<StreamTimelineItem, { kind: 'text' }> => item.kind === 'text')
      .map((item) => item.text)
      .join('')
  }

  get sanitizedText(): string {
    return sanitizeAssistantGeneratedText(this.text)
  }

  get reasoning(): string {
    return this._timeline
      .filter(
        (item): item is Extract<StreamTimelineItem, { kind: 'reasoning' }> =>
          item.kind === 'reasoning'
      )
      .map((item) => item.text)
      .join('\n')
  }

  get toolCalls(): ToolCallSnapshot[] {
    return this._timeline
      .filter((item): item is Extract<StreamTimelineItem, { kind: 'tool' }> => item.kind === 'tool')
      .map((item) => ({
        callId: item.callId,
        name: item.name,
        arguments: item.arguments
      }))
  }

  get toolResults(): ToolResultSnapshot[] {
    return this._timeline
      .filter(
        (item): item is Extract<StreamTimelineItem, { kind: 'tool' }> =>
          item.kind === 'tool' && item.result !== undefined
      )
      .map((item) => ({
        callId: item.callId,
        result: item.result
      }))
  }

  get usage(): StreamTokenUsage {
    return {
      inputTokens: this._inputTokens,
      outputTokens: this._outputTokens,
      cacheReadInputTokens: this._cacheReadInputTokens,
      cacheWriteInputTokens: this._cacheWriteInputTokens
    }
  }

  add(part: unknown): void {
    const p = part as Record<string, unknown>
    switch (p.type) {
      case 'text-delta': {
        const delta =
          p.textDelta != null ? String(p.textDelta) : p.text != null ? String(p.text) : ''
        if (delta) this.appendText(delta)
        break
      }

      case 'reasoning-delta': {
        const delta =
          p.textDelta != null ? String(p.textDelta) : p.text != null ? String(p.text) : ''
        if (delta) this.appendReasoning(delta)
        break
      }

      case 'tool-call': {
        const toolName = String(p.toolName ?? p.name ?? '').trim()
        if (p.toolCallId && toolName) {
          const legacyArgs =
            p.args ?? (p.providerMetadata as Record<string, unknown> | undefined)?.raw
          const rawInput = (legacyArgs as { input?: unknown } | undefined)?.input
          const inputArgs =
            typeof p.input === 'string' ? p.input : JSON.stringify(p.input ?? rawInput ?? {})

          this._timeline.push({
            kind: 'tool',
            callId: String(p.toolCallId),
            name: toolName,
            arguments: inputArgs,
            status: 'running'
          })
        }
        break
      }

      case 'tool-result': {
        if (p.toolCallId) {
          const callId = String(p.toolCallId)
          const tool = this._timeline.find(
            (item): item is Extract<StreamTimelineItem, { kind: 'tool' }> =>
              item.kind === 'tool' && item.callId === callId
          )
          if (tool) {
            const raw = (p.providerMetadata as Record<string, unknown> | undefined)?.raw
            tool.result = p.output ?? p.result ?? raw
            tool.status = 'completed'
          }
        }
        break
      }

      case 'finish-step': {
        this.ingestUsage(
          p.usage as Record<string, unknown> | undefined,
          p.providerMetadata as Record<string, unknown> | undefined,
          true
        )
        break
      }

      case 'finish': {
        const usage = (p.usage ?? p.totalUsage) as Record<string, unknown> | undefined
        this.ingestUsage(usage, p.providerMetadata as Record<string, unknown> | undefined, false)
        break
      }

      default: {
        const partType = String(p.type)
        if (partType === 'finish-step') {
          this.ingestUsage(
            p.usage as Record<string, unknown> | undefined,
            p.providerMetadata as Record<string, unknown> | undefined,
            true
          )
          break
        }
        if (p.usage || p.usageMetadata || p.providerMetadata) {
          logger.info(
            '[StreamAccumulator] Unknown chunk with potential usage metadata:',
            JSON.stringify(part)
          )
        }
        break
      }
    }
  }

  private appendReasoning(delta: string): void {
    const last = this._timeline[this._timeline.length - 1]
    if (last?.kind === 'reasoning') {
      last.text += delta
      return
    }
    this._timeline.push({ kind: 'reasoning', text: delta })
  }

  private appendText(delta: string): void {
    const last = this._timeline[this._timeline.length - 1]
    if (last?.kind === 'text') {
      last.text += delta
      return
    }
    this._timeline.push({ kind: 'text', text: delta })
  }

  private ingestUsage(
    usage: Record<string, unknown> | undefined,
    metadata: Record<string, unknown> | undefined,
    accumulate: boolean
  ): void {
    if (!usage) return

    const stepInput = readNumber(usage.inputTokens ?? usage.promptTokens)
    const stepOutput = readNumber(usage.outputTokens ?? usage.completionTokens)
    const cache = extractCacheUsageFromRecord(usage, metadata)

    if (accumulate) {
      this._inputTokens += stepInput
      this._outputTokens += stepOutput
      this._cacheReadInputTokens += cache.cacheReadInputTokens
      this._cacheWriteInputTokens += cache.cacheWriteInputTokens
      logger.info(
        `[StreamAccumulator] Step finish usage: input=${stepInput}, output=${stepOutput}, cacheRead=${cache.cacheReadInputTokens}`
      )
      return
    }

    this._inputTokens = stepInput
    this._outputTokens = stepOutput
    this._cacheReadInputTokens = cache.cacheReadInputTokens
    this._cacheWriteInputTokens = cache.cacheWriteInputTokens
    logger.info(
      `[StreamAccumulator] Finish usage: input=${this._inputTokens}, output=${this._outputTokens}, cacheRead=${this._cacheReadInputTokens}, cacheWrite=${this._cacheWriteInputTokens}`
    )
  }
}
