import type { NotebookGraphExtractStateRawRecord } from '@baishou/shared'

/**
 * 跳过完整抽取：哈希未变、窗口抽完、且整批对齐已经写入。
 * 老记录缺 alignWritten 视为对齐未完成，不能跳过。
 */
export function isNotebookGraphExtractComplete(
  state:
    | Pick<
        NotebookGraphExtractStateRawRecord,
        'extractedTextHash' | 'windowsDone' | 'windowsTotal' | 'alignWritten'
      >
    | null
    | undefined,
  textHash: string
): boolean {
  if (!state) return false
  if (state.extractedTextHash !== textHash) return false
  if (state.windowsTotal <= 0 || state.windowsDone < state.windowsTotal) return false
  return state.alignWritten === true
}

/** 同哈希且窗口已抽完，但整批对齐尚未写入：只跑对齐，不再调抽取模型。 */
export function shouldRunNotebookGraphAlignOnly(
  state:
    | Pick<
        NotebookGraphExtractStateRawRecord,
        'extractedTextHash' | 'windowsDone' | 'windowsTotal' | 'alignWritten' | 'extractedWindows'
      >
    | null
    | undefined,
  textHash: string
): boolean {
  if (!state || state.extractedTextHash !== textHash) return false
  if (state.alignWritten === true) return false
  if (state.windowsTotal <= 0 || state.windowsDone < state.windowsTotal) return false
  return Array.isArray(state.extractedWindows)
}

/** 资料已抽出但 extract-state 缺对齐标记，或窗口未完成 → 仍要排 graph job。 */
export function needsNotebookGraphExtractJob(input: {
  extractedHash: string | null
  extractState: {
    extractedTextHash: string
    windowsDone: number
    windowsTotal: number
    extractedWindows?: unknown
    alignWritten?: boolean
  } | null
}): boolean {
  if (!input.extractedHash) return false
  const state = input.extractState
  if (!state) return true
  if (state.extractedTextHash !== input.extractedHash) return true
  if (state.windowsTotal <= 0 || state.windowsDone < state.windowsTotal) return true
  if (state.alignWritten === true) return false
  // 新检查点带着 extractedWindows 却没写对齐：中断后续跑
  if (Array.isArray(state.extractedWindows)) return true
  // 老记录没有新字段，窗口已齐：节点当时已经按窗写过，不再重排
  return false
}
