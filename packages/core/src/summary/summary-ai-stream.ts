import { streamText, type LanguageModel } from 'ai'

export const SUMMARY_FIRST_OUTPUT_TIMEOUT_ERROR_NAME = 'TimeoutError'

export type SummaryStreamReaderSource = {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: unknown }>
    releaseLock: () => void
  }
}

export function createSummaryFirstOutputTimeoutError(timeoutMs: number): Error {
  const error = new Error(
    `AI generation timeout: timed out after ${timeoutMs / 1000} seconds waiting for first output.`
  )
  error.name = SUMMARY_FIRST_OUTPUT_TIMEOUT_ERROR_NAME
  return error
}

export function isSummaryFirstOutputTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : ''
  return (
    name === SUMMARY_FIRST_OUTPUT_TIMEOUT_ERROR_NAME ||
    message.includes('waiting for first output')
  )
}

export function isSummaryUserAbortError(error: unknown, userSignal?: AbortSignal): boolean {
  if (userSignal?.aborted) return true
  if (isSummaryFirstOutputTimeoutError(error)) return false
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
}

export function suppressUnusedSummaryStreamSettlements(streamResult: {
  text?: PromiseLike<unknown>
  usage?: PromiseLike<unknown>
  response?: PromiseLike<unknown>
}): void {
  void Promise.resolve(streamResult.text).catch(() => undefined)
  void Promise.resolve(streamResult.usage).catch(() => undefined)
  void Promise.resolve(streamResult.response).catch(() => undefined)
}

export function isSummaryModelOutputPart(part: {
  type?: string
  textDelta?: string
  text?: string
}): boolean {
  if (part.type !== 'text-delta' && part.type !== 'reasoning-delta' && part.type !== 'reasoning') {
    return false
  }
  return Boolean((part.textDelta ?? part.text ?? '').length)
}

function readPartText(part: { textDelta?: string; text?: string }): string {
  return part.textDelta ?? part.text ?? ''
}

/**
 * 只在尚未收到模型输出时计时。
 * 收到 text-delta 或 reasoning-delta 后清除超时，之后只响应用户取消。
 */
export async function collectSummaryStreamText(options: {
  fullStream?: SummaryStreamReaderSource
  textStream?: AsyncIterable<string>
  abortController: AbortController
  firstOutputTimeoutMs: number
  onFirstOutput?: () => void
  onTextDelta?: (text: string) => void
  onReasoningDelta?: (reasoning: string) => void
}): Promise<string> {
  const { abortController, firstOutputTimeoutMs, onFirstOutput } = options
  if (abortController.signal.aborted) {
    throw new DOMException('The operation was aborted', 'AbortError')
  }

  let firstOutputSeen = false
  let timedOut = false
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let rejectWait: ((error: Error) => void) | undefined
  const waitingForFirstOutput = new Promise<never>((_, reject) => {
    rejectWait = reject
    timeoutId = setTimeout(() => {
      timedOut = true
      abortController.abort()
      reject(createSummaryFirstOutputTimeoutError(firstOutputTimeoutMs))
    }, firstOutputTimeoutMs)
  })

  const onAbort = () => {
    if (timedOut) return
    rejectWait?.(new DOMException('The operation was aborted', 'AbortError'))
  }
  abortController.signal.addEventListener('abort', onAbort, { once: true })

  const markFirstOutput = () => {
    if (firstOutputSeen) return
    firstOutputSeen = true
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
      timeoutId = undefined
    }
    onFirstOutput?.()
  }

  const awaitBeforeFirstOutput = async <T>(operation: Promise<T>): Promise<T> => {
    if (firstOutputSeen) return operation
    return Promise.race([operation, waitingForFirstOutput])
  }

  try {
    if (options.fullStream) {
      return await collectFromFullStream(
        options.fullStream,
        awaitBeforeFirstOutput,
        markFirstOutput,
        options.onTextDelta,
        options.onReasoningDelta
      )
    }
    if (options.textStream) {
      return await collectFromTextStream(
        options.textStream,
        awaitBeforeFirstOutput,
        markFirstOutput,
        options.onTextDelta
      )
    }
    throw new Error('Summary stream is missing both fullStream and textStream')
  } catch (error) {
    if (timedOut) throw createSummaryFirstOutputTimeoutError(firstOutputTimeoutMs)
    throw error
  } finally {
    abortController.signal.removeEventListener('abort', onAbort)
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

async function collectFromFullStream(
  fullStream: SummaryStreamReaderSource,
  awaitBeforeFirstOutput: <T>(operation: Promise<T>) => Promise<T>,
  markFirstOutput: () => void,
  onTextDelta?: (text: string) => void,
  onReasoningDelta?: (reasoning: string) => void
): Promise<string> {
  const reader = fullStream.getReader()
  let text = ''
  let reasoning = ''
  try {
    while (true) {
      const readPromise = reader.read()
      void readPromise.catch(() => undefined)
      const { done, value } = await awaitBeforeFirstOutput(readPromise)
      if (done) break

      const part = (value ?? {}) as {
        type?: string
        textDelta?: string
        text?: string
        error?: unknown
      }
      if (part.type === 'error') {
        throw part.error instanceof Error
          ? part.error
          : new Error(String(part.error ?? 'Summary stream error'))
      }
      if (part.type === 'abort') {
        throw new DOMException('The operation was aborted', 'AbortError')
      }
      if (!isSummaryModelOutputPart(part)) continue

      markFirstOutput()
      const piece = readPartText(part)
      if (part.type === 'reasoning-delta' || part.type === 'reasoning') {
        reasoning += piece
        onReasoningDelta?.(reasoning)
        continue
      }
      if (part.type === 'text-delta') {
        text += piece
        onTextDelta?.(text)
      }
    }
    return text
  } finally {
    reader.releaseLock()
  }
}

async function collectFromTextStream(
  textStream: AsyncIterable<string>,
  awaitBeforeFirstOutput: <T>(operation: Promise<T>) => Promise<T>,
  markFirstOutput: () => void,
  onTextDelta?: (text: string) => void
): Promise<string> {
  const iterator = textStream[Symbol.asyncIterator]()
  let text = ''
  while (true) {
    const nextPromise = iterator.next()
    void nextPromise.catch(() => undefined)
    const { done, value } = await awaitBeforeFirstOutput(nextPromise)
    if (done) break
    if (!value) continue
    markFirstOutput()
    text += value
    onTextDelta?.(text)
  }
  return text
}

export async function generateSummaryTextFromModel(options: {
  model: LanguageModel
  prompt: string
  system?: string
  abortController: AbortController
  firstOutputTimeoutMs: number
  onFirstOutput?: () => void
  onTextDelta?: (text: string) => void
  onReasoningDelta?: (reasoning: string) => void
  providerOptions?: Record<string, Record<string, unknown>>
}): Promise<string> {
  const streamResult = streamText({
    model: options.model,
    ...(options.system ? { system: options.system } : {}),
    prompt: options.prompt,
    maxSteps: 1,
    abortSignal: options.abortController.signal,
    ...(options.providerOptions ? { providerOptions: options.providerOptions } : {})
  } as never)

  suppressUnusedSummaryStreamSettlements(streamResult)

  return collectSummaryStreamText({
    fullStream: streamResult.fullStream,
    textStream: streamResult.textStream,
    abortController: options.abortController,
    firstOutputTimeoutMs: options.firstOutputTimeoutMs,
    onFirstOutput: options.onFirstOutput,
    onTextDelta: options.onTextDelta,
    onReasoningDelta: options.onReasoningDelta
  })
}
