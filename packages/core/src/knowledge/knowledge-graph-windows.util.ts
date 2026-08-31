export interface KnowledgeGraphWindow {
  index: number
  text: string
  start: number
  end: number
  sourceRef: string
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
    for (const page of pages) {
      const slice = body.slice(page.start, page.end)
      if (buf && buf.length + slice.length > windowChars) {
        windows.push({
          index: windows.length,
          text: buf,
          start,
          end,
          sourceRef: `${sourceId}#${windows.length}`
        })
        if (windows.length >= maxWindows) {
          return { windows, truncated: true }
        }
        buf = slice
        start = page.start
        end = page.end
      } else {
        buf = buf ? `${buf}\n\n${slice}` : slice
        end = page.end
      }
    }
    if (buf.trim()) {
      windows.push({
        index: windows.length,
        text: buf,
        start,
        end,
        sourceRef: `${sourceId}#${windows.length}`
      })
    }
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
