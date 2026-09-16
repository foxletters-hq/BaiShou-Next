import {
  assertBatchEmbedCanContinue,
  beginBatchEmbedControl,
  endBatchEmbedControl,
  isBatchEmbedAbortRequested,
  isBatchEmbedAbortedError,
  isBatchEmbedPaused,
  requestBatchEmbedCancel,
  requestBatchEmbedPause,
  requestBatchEmbedResume
} from '@baishou/shared'

/** 移动端 RAG 批量嵌入 / 重嵌入 共享取消标志 */
export class MobileRagAbortError extends Error {
  constructor(public readonly embeddedCount = 0) {
    super('Mobile RAG operation aborted')
    this.name = 'MobileRagAbortError'
  }
}

export class MobileRagOperationControl {
  reset(): void {
    endBatchEmbedControl()
  }

  begin(): void {
    beginBatchEmbedControl()
  }

  requestAbort(): void {
    requestBatchEmbedCancel()
  }

  requestPause(): void {
    requestBatchEmbedPause()
  }

  requestResume(): void {
    requestBatchEmbedResume()
  }

  end(): void {
    endBatchEmbedControl()
  }

  get isAborted(): boolean {
    return isBatchEmbedAbortRequested()
  }

  get isPaused(): boolean {
    return isBatchEmbedPaused()
  }
}

export const mobileRagOperationControl = new MobileRagOperationControl()

export async function abortableMobileRagDelay(
  ms: number,
  control: MobileRagOperationControl
): Promise<void> {
  if (ms <= 0 || control.isAborted) {
    if (control.isAborted) throw new MobileRagAbortError()
    return
  }

  const step = 100
  let elapsed = 0
  while (elapsed < ms) {
    await assertMobileRagCanContinue(control)
    const slice = Math.min(step, ms - elapsed)
    await new Promise((resolve) => setTimeout(resolve, slice))
    elapsed += slice
  }
}

export async function assertMobileRagCanContinue(
  control: MobileRagOperationControl = mobileRagOperationControl
): Promise<void> {
  try {
    await assertBatchEmbedCanContinue()
  } catch (error) {
    if (isBatchEmbedAbortedError(error) || control.isAborted) {
      throw new MobileRagAbortError()
    }
    throw error
  }
  if (control.isAborted) throw new MobileRagAbortError()
}
