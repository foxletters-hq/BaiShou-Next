import { TextStreamPart } from 'ai'
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

function readNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' ? (value as UnknownRecord) : undefined
}

/**
 * 从 AI SDK 的 usage（LanguageModelUsage）与 providerMetadata 中提取缓存读 / 写 token。
 * 优先读取 SDK 标准字段 inputTokenDetails（SDK 已按 step 或 total 聚合），
 * 其次兼容各厂商原始字段（raw / providerMetadata）。
 */
export function extractCacheUsage(
  usage: UnknownRecord | undefined,
  metadata?: UnknownRecord | undefined
): Pick<StreamTokenUsage, 'cacheReadInputTokens' | 'cacheWriteInputTokens'> {
  const details = asRecord(usage?.inputTokenDetails)
  const raw = asRecord(usage?.raw)
  const anthropic = asRecord(metadata?.anthropic)
  const vertex = asRecord(metadata?.vertex)
  const bedrockUsage = asRecord(asRecord(metadata?.bedrock)?.usage)
  const openai = asRecord(metadata?.openai)
  const google = asRecord(metadata?.google)

  const cacheReadInputTokens = readNumber(
    details?.cacheReadTokens ??
      usage?.cachedInputTokens ??
      usage?.cacheReadInputTokens ??
      asRecord(usage?.promptTokensDetails)?.cachedTokens ??
      asRecord(usage?.inputTokensDetails)?.cachedTokens ??
      raw?.cache_read_input_tokens ??
      anthropic?.cacheReadInputTokens ??
      anthropic?.cache_read_input_tokens ??
      vertex?.cacheReadInputTokens ??
      bedrockUsage?.cacheReadInputTokens ??
      openai?.cachedPromptTokens ??
      google?.cachedContentTokenCount
  )

  const cacheWriteInputTokens = readNumber(
    details?.cacheWriteTokens ??
      usage?.cacheWriteInputTokens ??
      usage?.cacheCreationInputTokens ??
      raw?.cache_creation_input_tokens ??
      anthropic?.cacheCreationInputTokens ??
      anthropic?.cache_creation_input_tokens ??
      vertex?.cacheCreationInputTokens ??
      bedrockUsage?.cacheWriteInputTokens
  )

  return { cacheReadInputTokens, cacheWriteInputTokens }
}

export class StreamAccumulator {
  private _textBuffer: string = ''
  private _reasoningBuffer: string = ''

  private _inputTokens: number = 0
  private _outputTokens: number = 0
  private _cacheReadInputTokens: number = 0
  private _cacheWriteInputTokens: number = 0

  private _toolCalls: Map<string, ToolCallSnapshot> = new Map()
  private _toolResults: Map<string, ToolResultSnapshot> = new Map()

  get text(): string {
    return this._textBuffer
  }

  get sanitizedText(): string {
    return sanitizeAssistantGeneratedText(this._textBuffer)
  }

  get reasoning(): string {
    return this._reasoningBuffer
  }

  get toolCalls(): ToolCallSnapshot[] {
    return Array.from(this._toolCalls.values())
  }

  get toolResults(): ToolResultSnapshot[] {
    return Array.from(this._toolResults.values())
  }

  get usage(): StreamTokenUsage {
    return {
      inputTokens: this._inputTokens,
      outputTokens: this._outputTokens,
      cacheReadInputTokens: this._cacheReadInputTokens,
      cacheWriteInputTokens: this._cacheWriteInputTokens
    }
  }

  add(part: TextStreamPart<any>): void {
    const p = part as Record<string, unknown>
    switch (p.type) {
      case 'text-delta': {
        if (p.textDelta) {
          this._textBuffer += String(p.textDelta)
        } else if (p.text) {
          this._textBuffer += String(p.text)
        }
        break
      }

      case 'reasoning-delta': {
        if (p.textDelta) {
          this._reasoningBuffer += String(p.textDelta)
        } else if (p.text) {
          this._reasoningBuffer += String(p.text)
        }
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

          this._toolCalls.set(String(p.toolCallId), {
            callId: String(p.toolCallId),
            name: toolName,
            arguments: inputArgs
          })
        }
        break
      }

      case 'tool-result': {
        if (p.toolCallId && this._toolCalls.has(String(p.toolCallId))) {
          const raw = (p.providerMetadata as Record<string, unknown> | undefined)?.raw
          const res = p.output ?? p.result ?? raw
          this._toolResults.set(String(p.toolCallId), {
            callId: String(p.toolCallId),
            result: res
          })
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
        // finish 事件的 totalUsage 为全部步骤累计；usage 仅为最后一步，不能用于整轮计费
        const usage = (p.totalUsage ?? p.usage) as Record<string, unknown> | undefined
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

  private ingestUsage(
    usage: Record<string, unknown> | undefined,
    metadata: Record<string, unknown> | undefined,
    accumulate: boolean
  ): void {
    if (!usage) return

    const stepInput = readNumber(usage.inputTokens ?? usage.promptTokens)
    const stepOutput = readNumber(usage.outputTokens ?? usage.completionTokens)
    const cache = extractCacheUsage(usage, metadata)

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
