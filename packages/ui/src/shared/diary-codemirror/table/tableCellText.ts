/** 表格单元格 Markdown 源码与编辑态 plain text 互转 */

export const TABLE_CELL_LINE_BREAK = '<br />'

export function decodeTableCellText(raw: string): string {
  return raw
    .replace(/\\\|/g, '|')
    .split(/<br\s*\/?>/gi)
    .join('\n')
    .trim()
}

export function encodeTableCellText(value: string): string {
  return value
    .split('\n')
    .map((line) => line.replace(/\|/g, '\\|').trim())
    .filter((line, index, lines) => line.length > 0 || (index === 0 && lines.length === 1))
    .join(TABLE_CELL_LINE_BREAK)
}

export function normalizeTableCellDisplay(raw: string): string {
  return decodeTableCellText(raw).replace(/\n/g, ' ')
}

/** 桌面表格单元格展示：保留换行，配合 pre-wrap */
export function formatDesktopTableCellDisplay(raw: string): string {
  return decodeTableCellText(raw)
}
