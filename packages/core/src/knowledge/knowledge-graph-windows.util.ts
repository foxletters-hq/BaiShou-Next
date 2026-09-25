export interface KnowledgeGraphWindow {
  index: number
  text: string
  start: number
  end: number
  sourceRef: string
  /** 这一窗盖住的第一页。没有页边界时不填。 */
  pageFrom?: number
  /** 这一窗盖住的最后一页，含本页。 */
  pageTo?: number
}

export type KnowledgeGraphExtractProgress = {
  windowsDone: number
  windowsTotal: number
  pageFrom?: number
  pageTo?: number
  pageTotal?: number
}

const DEFAULT_WINDOW_CHARS = 5000
const DEFAULT_MAX_WINDOWS = 20

export function splitKnowledgeGraphWindows(
  text: string,
  sourceId: string,
  pages?: Array<{ page: number; start: number; end: number }> | null,
  opts?: { windowChars?: number; maxWindows?: number }
): { windows: KnowledgeGraphWindow[]; truncated: boolean } {
  const body = text ?? ''
  const windowChars = opts?.windowChars ?? DEFAULT_WINDOW_CHARS
  const maxWindows = opts?.maxWindows ?? DEFAULT_MAX_WINDOWS
  if (!body.trim()) return { windows: [], truncated: false }

  if (pages && pages.length > 0) {
    const windows: KnowledgeGraphWindow[] = []
    let buf = ''
    let start = pages[0]!.start
    let end = pages[0]!.start
    let pageFrom = pages[0]!.page
    let pageTo = pages[0]!.page
    const pushWindow = () => {
      windows.push({
        index: windows.length,
        text: buf,
        start,
        end,
        sourceRef: `${sourceId}#${windows.length}`,
        pageFrom,
        pageTo
      })
    }
    for (const page of pages) {
      const slice = body.slice(page.start, page.end)
      if (buf && buf.length + slice.length > windowChars) {
        pushWindow()
        if (windows.length >= maxWindows) {
          return { windows, truncated: true }
        }
        buf = slice
        start = page.start
        end = page.end
        pageFrom = page.page
        pageTo = page.page
      } else {
        if (!buf) {
          start = page.start
          pageFrom = page.page
        }
        buf = buf ? `${buf}\n\n${slice}` : slice
        end = page.end
        pageTo = page.page
      }
    }
    if (buf.trim()) pushWindow()
    return { windows: windows.slice(0, maxWindows), truncated: windows.length > maxWindows }
  }

  const windows: KnowledgeGraphWindow[] = []
  let offset = 0
  while (offset < body.length && windows.length < maxWindows) {
    const end = Math.min(body.length, offset + windowChars)
    windows.push({
      index: windows.length,
      text: body.slice(offset, end),
      start: offset,
      end,
      sourceRef: `${sourceId}#${windows.length}`
    })
    offset = end
  }
  return { windows, truncated: offset < body.length }
}

export function knowledgeGraphPageTotal(
  pages?: Array<{ page: number }> | null
): number {
  if (!pages?.length) return 0
  return pages.reduce((max, page) => Math.max(max, page.page), 0)
}

/** 当前窗口序号对应的页码。windowsDone 是从 1 起的当前窗，0 表示还没开始。 */
export function knowledgeGraphExtractProgress(
  windows: KnowledgeGraphWindow[],
  windowsDone: number,
  pageTotal: number
): KnowledgeGraphExtractProgress {
  const progress: KnowledgeGraphExtractProgress = {
    windowsDone,
    windowsTotal: windows.length
  }
  if (pageTotal <= 0 || windowsDone <= 0) return progress
  const win = windows[Math.min(windows.length, windowsDone) - 1]
  if (!win?.pageFrom || !win.pageTo) return progress
  return {
    ...progress,
    pageFrom: win.pageFrom,
    pageTo: win.pageTo,
    pageTotal
  }
}

/** 按抽取时的切窗规则回读第 n 个窗口；越界返回 null */
export function resolveKnowledgeGraphWindow(input: {
  text: string
  sourceId: string
  windowIndex: number
  pages?: Array<{ page: number; start: number; end: number }> | null
}): KnowledgeGraphWindow | null {
  if (!Number.isInteger(input.windowIndex) || input.windowIndex < 0) return null
  const { windows } = splitKnowledgeGraphWindows(input.text, input.sourceId, input.pages)
  return windows[input.windowIndex] ?? null
}
