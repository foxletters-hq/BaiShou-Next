/** 移动端 RAG 批量嵌入 / 重嵌入 共享取消标志 */
export class MobileRagAbortError extends Error {
  constructor(public readonly embeddedCount = 0) {
    super('Mobile RAG operation aborted')
    this.name = 'MobileRagAbortError'
  }
}

export class MobileRagOperationControl {
  private aborted = false

  reset(): void {
    this.aborted = false
  }

  requestAbort(): void {
    this.aborted = true
  }

  get isAborted(): boolean {
    return this.aborted
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
    if (control.isAborted) throw new MobileRagAbortError()
    const slice = Math.min(step, ms - elapsed)
    await new Promise((resolve) => setTimeout(resolve, slice))
    elapsed += slice
  }
}
