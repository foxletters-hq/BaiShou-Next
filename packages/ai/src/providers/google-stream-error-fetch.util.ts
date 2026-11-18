import {
  createProviderContentFilterError,
  isContentFilterFinishReason,
  isProviderContentFilterError,
  logger
} from '@baishou/shared'
import { extractApiErrorMessage } from './provider-api-error.util'

const MAX_INSPECT_LINE_BYTES = 256 * 1024
const MAX_RAW_NON_SSE_CHARS = 64 * 1024
const GOOGLE_GENERATE_ENDPOINT_RE = /:(?:streamGenerateContent|generateContent)(?:$|\?)/i

interface GoogleStreamInspectState {
  sawSseEvent: boolean
  sawCandidateContent: boolean
  promptBlockReason?: string
  candidateFinishReason?: string
  candidateFinishMessage?: string
  rawNonSseBuffer: string
  immediateError?: Error
}

function isGoogleGenerateUrl(url: RequestInfo | URL): boolean {
  const urlStr = typeof url === 'string' ? url : url.toString()
  return GOOGLE_GENERATE_ENDPOINT_RE.test(urlStr)
}

function concatUint8Arrays(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b
  if (b.length === 0) return a
  const out = new Uint8Array(a.length + b.length)
  out.set(a, 0)
  out.set(b, a.length)
  return out
}

function candidateHasVisibleContent(candidate: Record<string, unknown>): boolean {
  const content = candidate.content
  if (!content || typeof content !== 'object') return false
  const parts = (content as { parts?: unknown }).parts
  if (!Array.isArray(parts)) return false
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    const rec = part as Record<string, unknown>
    if (typeof rec.text === 'string' && rec.text.length > 0) return true
    if (
      rec.functionCall != null ||
      rec.executableCode != null ||
      rec.codeExecutionResult != null ||
      rec.inlineData != null ||
      rec.toolCall != null ||
      rec.toolResponse != null
    ) {
      return true
    }
  }
  return false
}

function buildUpstreamPayloadError(payload: Record<string, unknown>, rawText: string): Error {
  const synthetic = {
    responseBody: rawText,
    data: payload
  }
  const detail = extractApiErrorMessage(synthetic)
  const errObj = payload.error as { code?: unknown; status?: unknown } | undefined
  const statusCode =
    typeof errObj?.code === 'number' && Number.isFinite(errObj.code) ? errObj.code : undefined

  if (isProviderContentFilterError(synthetic) || isProviderContentFilterError(detail)) {
    return createProviderContentFilterError(statusCode ? `[${statusCode}] ${detail}` : detail)
  }

  const error = new Error(detail) as Error & {
    statusCode?: number
    responseBody?: string
    data?: unknown
  }
  if (statusCode !== undefined) {
    error.statusCode = statusCode
  }
  error.responseBody = rawText
  error.data = payload
  return error
}

function formatGoogleBlockDetail(state: GoogleStreamInspectState): string {
  const parts: string[] = []
  if (state.promptBlockReason) {
    parts.push(`promptFeedback.blockReason=${state.promptBlockReason}`)
  }
  if (state.candidateFinishReason) {
    parts.push(`finishReason=${state.candidateFinishReason}`)
  }
  if (state.candidateFinishMessage) {
    parts.push(`finishMessage=${state.candidateFinishMessage}`)
  }
  return parts.join(', ') || 'blocked_without_output'
}

function inspectGooglePayloadObject(
  obj: unknown,
  rawText: string,
  state: GoogleStreamInspectState
): void {
  if (state.immediateError || !obj || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const item of obj) {
      inspectGooglePayloadObject(item, rawText, state)
      if (state.immediateError) return
    }
    return
  }

  const record = obj as Record<string, unknown>
  if (record.error != null) {
    state.immediateError = buildUpstreamPayloadError(record, rawText)
    return
  }

  const promptFeedback = record.promptFeedback
  if (promptFeedback && typeof promptFeedback === 'object') {
    const blockReason = (promptFeedback as { blockReason?: unknown }).blockReason
    if (typeof blockReason === 'string' && blockReason.trim()) {
      state.promptBlockReason = blockReason.trim()
    }
  }

  const candidates = record.candidates
  if (Array.isArray(candidates) && candidates.length > 0) {
    const first = candidates[0]
    if (first && typeof first === 'object') {
      const candidate = first as Record<string, unknown>
      if (candidateHasVisibleContent(candidate)) {
        state.sawCandidateContent = true
      }
      if (typeof candidate.finishReason === 'string' && candidate.finishReason.trim()) {
        state.candidateFinishReason = candidate.finishReason.trim()
      }
      if (typeof candidate.finishMessage === 'string' && candidate.finishMessage.trim()) {
        state.candidateFinishMessage = candidate.finishMessage.trim()
      }
    }
  }
}

function inspectLineText(lineText: string, state: GoogleStreamInspectState): void {
  const trimmed = lineText.replace(/\r$/, '').trim()
  if (!trimmed) return

  if (trimmed.startsWith('data:')) {
    state.sawSseEvent = true
    const dataPayload = trimmed.slice(5).trim()
    if (!dataPayload || dataPayload === '[DONE]') return
    try {
      const parsed = JSON.parse(dataPayload) as unknown
      inspectGooglePayloadObject(parsed, dataPayload, state)
    } catch {
      // 非 JSON SSE data 行交由下游处理
    }
    return
  }

  if (
    !state.sawSseEvent &&
    !trimmed.startsWith('event:') &&
    !trimmed.startsWith('id:') &&
    !trimmed.startsWith('retry:') &&
    !trimmed.startsWith(':')
  ) {
    if (state.rawNonSseBuffer.length + trimmed.length <= MAX_RAW_NON_SSE_CHARS) {
      state.rawNonSseBuffer += (state.rawNonSseBuffer ? '\n' : '') + trimmed
    }
  }
}

function resolveBlockedStreamError(state: GoogleStreamInspectState): Error | null {
  if (state.immediateError) {
    return state.immediateError
  }
  if (!state.sawSseEvent && state.rawNonSseBuffer.trim()) {
    try {
      const parsed = JSON.parse(state.rawNonSseBuffer) as unknown
      inspectGooglePayloadObject(parsed, state.rawNonSseBuffer, state)
      if (state.immediateError) {
        return state.immediateError
      }
    } catch {
      // ignore non-JSON tail
    }
  }
  if (
    !state.sawCandidateContent &&
    (Boolean(state.promptBlockReason) || isContentFilterFinishReason(state.candidateFinishReason))
  ) {
    return createProviderContentFilterError(formatGoogleBlockDetail(state))
  }
  return null
}

function createResponseWithBody(res: Response, body: ReadableStream<Uint8Array>): Response {
  return new Proxy(res, {
    get(target, prop) {
      if (prop === 'body') {
        return body
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}

function createResponseWithText(res: Response, rawText: string): Response {
  const bytes = new TextEncoder().encode(rawText)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes.length > 0) {
        controller.enqueue(bytes)
      }
      controller.close()
    }
  })

  return new Proxy(res, {
    get(target, prop) {
      if (prop === 'body') return stream
      if (prop === 'text') return async () => rawText
      if (prop === 'json') return async () => JSON.parse(rawText)
      if (prop === 'arrayBuffer') return async () => bytes.buffer
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    }
  })
}

/**
 * 守护 Google / Vertex AI HTTP 200 响应：
 * 1. 捕获被 `@ai-sdk/google` chunkSchema 静默丢弃的流内 `{"error": ...}` 与 `promptFeedback.blockReason`；
 * 2. 捕获中转站以 HTTP 200 JSON 直接返回的错误或拦截体，防止落成「模型未返回任何内容」。
 */
export function wrapGoogleStreamErrorFetch(baseFetch: typeof fetch): typeof fetch {
  return async (url, init) => {
    const res = await baseFetch(url, init)
    if (!res.ok || !isGoogleGenerateUrl(url)) {
      return res
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
      const rawText = await res.text()
      const state: GoogleStreamInspectState = {
        sawSseEvent: false,
        sawCandidateContent: false,
        rawNonSseBuffer: ''
      }
      try {
        const parsed = JSON.parse(rawText) as unknown
        inspectGooglePayloadObject(parsed, rawText, state)
      } catch {
        return createResponseWithText(res, rawText)
      }

      const blockedErr = resolveBlockedStreamError(state)
      if (blockedErr) {
        logger.warn('[GoogleStreamGuard] JSON response blocked/errored:', {
          message: blockedErr.message,
          detail: formatGoogleBlockDetail(state)
        })
        throw blockedErr
      }
      return createResponseWithText(res, rawText)
    }

    if (!res.body) {
      return res
    }

    const decoder = new TextDecoder('utf-8')
    const state: GoogleStreamInspectState = {
      sawSseEvent: false,
      sawCandidateContent: false,
      rawNonSseBuffer: ''
    }
    let pendingLineBytes: Uint8Array = new Uint8Array(0)
    let skipOversizedLine = false

    const guardedStream = res.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          let start = 0
          for (let i = 0; i < chunk.length; i++) {
            if (chunk[i] !== 0x0a) continue
            const segment = chunk.subarray(start, i)
            if (!skipOversizedLine) {
              if (pendingLineBytes.length + segment.length <= MAX_INSPECT_LINE_BYTES) {
                const lineBytes = concatUint8Arrays(pendingLineBytes, segment)
                inspectLineText(decoder.decode(lineBytes), state)
              }
            }
            pendingLineBytes = new Uint8Array(0)
            skipOversizedLine = false
            start = i + 1
            if (state.immediateError) {
              logger.warn('[GoogleStreamGuard] Upstream SSE error chunk:', {
                message: state.immediateError.message
              })
              controller.error(state.immediateError)
              return
            }
          }

          if (start < chunk.length) {
            const tail = chunk.subarray(start)
            if (!skipOversizedLine) {
              if (pendingLineBytes.length + tail.length <= MAX_INSPECT_LINE_BYTES) {
                pendingLineBytes = concatUint8Arrays(pendingLineBytes, tail)
              } else {
                pendingLineBytes = new Uint8Array(0)
                skipOversizedLine = true
              }
            }
          }

          controller.enqueue(chunk)
        },
        flush(controller) {
          if (!skipOversizedLine && pendingLineBytes.length > 0) {
            inspectLineText(decoder.decode(pendingLineBytes), state)
            pendingLineBytes = new Uint8Array(0)
          }

          const blockedErr = resolveBlockedStreamError(state)
          if (blockedErr) {
            logger.warn('[GoogleStreamGuard] Stream ended blocked/errored:', {
              message: blockedErr.message,
              detail: formatGoogleBlockDetail(state)
            })
            controller.error(blockedErr)
          }
        }
      })
    )

    return createResponseWithBody(res, guardedStream)
  }
}
