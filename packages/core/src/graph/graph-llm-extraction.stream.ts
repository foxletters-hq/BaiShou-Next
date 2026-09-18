import { logger } from '@baishou/shared'

export function graphExtractAbortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError')
}

export function throwIfGraphExtractAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw graphExtractAbortError()
}

async function awaitAbortableText(
  textPromise: Promise<string>,
  signal?: AbortSignal
): Promise<string> {
  throwIfGraphExtractAborted(signal)
  if (!signal) return textPromise
  return new Promise<string>((resolve, reject) => {
    const onAbort = () => reject(graphExtractAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    textPromise.then(
      (text) => {
        signal.removeEventListener('abort', onAbort)
        if (signal.aborted) {
          reject(graphExtractAbortError())
          return
        }
        resolve(text)
      },
      (err) => {
        signal.removeEventListener('abort', onAbort)
        reject(err)
      }
    )
  })
}

type GraphExtractStreamPart = {
  type?: string
  text?: unknown
  textDelta?: unknown
  delta?: unknown
}

type GraphExtractStreamReaderSource = {
  getReader: () => {
    read: () => Promise<{ done: boolean; value?: unknown }>
    releaseLock: () => void
  }
}

function asGraphExtractTextChunk(value: unknown): string {
  if (typeof value === 'string') return value
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as { text?: unknown }).text === 'string'
  ) {
    return (value as { text: string }).text
  }
  return ''
}

function readGraphExtractPartText(part: GraphExtractStreamPart): string {
  return (
    asGraphExtractTextChunk(part.textDelta) ||
    asGraphExtractTextChunk(part.text) ||
    asGraphExtractTextChunk(part.delta) ||
    ''
  )
}

function isGraphExtractTextPart(part: GraphExtractStreamPart): boolean {
  return part.type === 'text-delta' || part.type === 'text'
}

function isGraphExtractReasoningPart(part: GraphExtractStreamPart): boolean {
  return part.type === 'reasoning-delta' || part.type === 'reasoning'
}

function isNoOutputGeneratedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if (
    (error as { [key: symbol]: unknown })[
      Symbol.for('vercel.ai.error.AI_NoOutputGeneratedError')
    ] === true
  ) {
    return true
  }
  const name = 'name' in error ? String(error.name) : ''
  const message = 'message' in error ? String(error.message) : ''
  return name === 'AI_NoOutputGeneratedError' || message.includes('NoOutputGenerated')
}

function isAsyncIterableStream(value: unknown): value is AsyncIterable<unknown> {
  return Boolean(value && typeof value === 'object' && Symbol.asyncIterator in value)
}

function isStreamReaderSource(value: unknown): value is GraphExtractStreamReaderSource {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as GraphExtractStreamReaderSource).getReader === 'function'
  )
}

function canIterateGraphExtractStream(stream: unknown): boolean {
  return isAsyncIterableStream(stream) || isStreamReaderSource(stream)
}

async function* iterateGraphExtractStream(stream: unknown): AsyncGenerator<unknown> {
  if (isAsyncIterableStream(stream)) {
    yield* stream
    return
  }
  if (!isStreamReaderSource(stream)) return
  const reader = stream.getReader()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

export async function collectGraphExtractStreamText(opts: {
  fullStream?: unknown
  textStream?: AsyncIterable<string>
  textPromise?: Promise<string>
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onReasoning?: (chars: number) => void
}): Promise<string> {
  throwIfGraphExtractAborted(opts.signal)
  if (opts.fullStream && canIterateGraphExtractStream(opts.fullStream)) {
    const consume = (async () => {
      let text = ''
      let reasoning = ''
      for await (const value of iterateGraphExtractStream(opts.fullStream)) {
        throwIfGraphExtractAborted(opts.signal)
        const part = (value ?? {}) as GraphExtractStreamPart
        if (part.type === 'error') {
          const err = (value as { error?: unknown } | null)?.error
          throw err instanceof Error ? err : new Error(String(err ?? 'Graph extract stream error'))
        }
        if (part.type === 'abort') {
          throw graphExtractAbortError()
        }
        const piece = readGraphExtractPartText(part)
        if (!piece) continue
        if (isGraphExtractReasoningPart(part)) {
          reasoning += piece
          opts.onReasoning?.(reasoning.length)
          continue
        }
        if (!isGraphExtractTextPart(part) && part.type) continue
        text += piece
        opts.onDelta?.(text.length)
      }
      return text
    })()
    void consume.catch(() => undefined)
    return awaitAbortableText(consume, opts.signal)
  }
  if (opts.textStream) {
    const consume = (async () => {
      let text = ''
      for await (const chunk of opts.textStream!) {
        throwIfGraphExtractAborted(opts.signal)
        const piece =
          typeof chunk === 'string'
            ? chunk
            : readGraphExtractPartText((chunk ?? {}) as GraphExtractStreamPart)
        if (!piece) continue
        text += piece
        opts.onDelta?.(text.length)
      }
      return text
    })()
    void consume.catch(() => undefined)
    return awaitAbortableText(consume, opts.signal)
  }
  if (!opts.textPromise) return ''
  const text = await awaitAbortableText(opts.textPromise, opts.signal)
  if (text) opts.onDelta?.(text.length)
  return text
}

export async function resolveGraphExtractLlmText(opts: {
  fullStream?: unknown
  textStream?: AsyncIterable<string>
  textPromise?: Promise<string>
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onReasoning?: (chars: number) => void
}): Promise<string> {
  throwIfGraphExtractAborted(opts.signal)
  let streamed = ''
  let streamError: unknown
  try {
    streamed = await collectGraphExtractStreamText({
      fullStream: opts.fullStream,
      textStream: canIterateGraphExtractStream(opts.fullStream) ? undefined : opts.textStream,
      signal: opts.signal,
      onDelta: opts.onDelta,
      onReasoning: opts.onReasoning
    })
  } catch (error) {
    if (opts.signal?.aborted || (error as { name?: string }).name === 'AbortError') throw error
    streamError = error
    logger.warn('[GraphExtract] LLM stream failed:', error as Error)
  }

  const trimmed = streamed.trim()
  if (trimmed) return trimmed

  if (opts.textPromise) {
    try {
      const fallback = await awaitAbortableText(opts.textPromise, opts.signal)
      const fallbackTrimmed = fallback?.trim() || ''
      if (fallbackTrimmed) {
        opts.onDelta?.(fallbackTrimmed.length)
        return fallbackTrimmed
      }
    } catch (error) {
      if (opts.signal?.aborted || (error as { name?: string }).name === 'AbortError') throw error
      if (isNoOutputGeneratedError(error)) return ''
      logger.warn('[GraphExtract] LLM call failed:', error as Error)
      throw error
    }
  }

  if (streamError) throw streamError
  return ''
}
