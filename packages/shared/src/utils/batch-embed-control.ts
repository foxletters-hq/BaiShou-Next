export class BatchEmbedAbortedError extends Error {
  readonly code = 'BATCH_EMBED_ABORTED' as const

  constructor() {
    super('BATCH_EMBED_ABORTED')
    this.name = 'BatchEmbedAbortedError'
  }
}

export function isBatchEmbedAbortedError(error: unknown): error is BatchEmbedAbortedError {
  return (
    error instanceof BatchEmbedAbortedError ||
    (error instanceof Error &&
      (error.name === 'BatchEmbedAbortedError' || error.message === 'BATCH_EMBED_ABORTED'))
  )
}

let sessionActive = false
let abortRequested = false
let paused = false
let pendingPause = false
let pendingCancel = false
let resumeWaiters: Array<() => void> = []

function flushResumeWaiters(): void {
  const waiters = resumeWaiters
  resumeWaiters = []
  for (const waiter of waiters) waiter()
}

export function isBatchEmbedSessionActive(): boolean {
  return sessionActive
}

export function isBatchEmbedPaused(): boolean {
  return sessionActive ? paused && !abortRequested : pendingPause && !pendingCancel
}

export function isBatchEmbedAbortRequested(): boolean {
  return sessionActive ? abortRequested : pendingCancel
}

export function beginBatchEmbedControl(): void {
  sessionActive = true
  abortRequested = pendingCancel
  paused = pendingPause && !pendingCancel
  pendingPause = false
  pendingCancel = false
  resumeWaiters = []
}

export function endBatchEmbedControl(): void {
  sessionActive = false
  abortRequested = false
  paused = false
  pendingPause = false
  pendingCancel = false
  flushResumeWaiters()
}

export function requestBatchEmbedPause(): void {
  if (!sessionActive) {
    pendingPause = true
    pendingCancel = false
    return
  }
  if (abortRequested) return
  paused = true
}

export function requestBatchEmbedResume(): void {
  if (!sessionActive) {
    pendingPause = false
    return
  }
  paused = false
  flushResumeWaiters()
}

export function requestBatchEmbedCancel(): void {
  if (!sessionActive) {
    pendingCancel = true
    pendingPause = false
    return
  }
  abortRequested = true
  paused = false
  flushResumeWaiters()
}

export async function checkpointBatchEmbed(): Promise<'ok' | 'aborted'> {
  if (!sessionActive) {
    return pendingCancel || abortRequested ? 'aborted' : 'ok'
  }
  if (abortRequested) return 'aborted'
  while (paused && !abortRequested) {
    await new Promise<void>((resolve) => {
      resumeWaiters.push(resolve)
    })
  }
  return abortRequested ? 'aborted' : 'ok'
}

export async function assertBatchEmbedCanContinue(): Promise<void> {
  if ((await checkpointBatchEmbed()) === 'aborted') {
    throw new BatchEmbedAbortedError()
  }
}

export function throwIfBatchEmbedAborted(): void {
  if (abortRequested || pendingCancel) {
    throw new BatchEmbedAbortedError()
  }
}
