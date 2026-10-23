const SIDE_WIDTH_KEY = 'baishou.notebook.graph.sideWidth.v1'
const SIDE_COLLAPSED_KEY = 'baishou.notebook.graph.sideCollapsed.v1'

export const NOTEBOOK_GRAPH_SIDE_WIDTH_MIN = 260
export const NOTEBOOK_GRAPH_SIDE_WIDTH_MAX = 520
export const NOTEBOOK_GRAPH_SIDE_WIDTH_DEFAULT = 300

export function clampNotebookGraphSideWidth(value: number): number {
  return Math.min(NOTEBOOK_GRAPH_SIDE_WIDTH_MAX, Math.max(NOTEBOOK_GRAPH_SIDE_WIDTH_MIN, value))
}

export function loadNotebookGraphSideWidth(
  read = () => localStorage.getItem(SIDE_WIDTH_KEY)
): number {
  try {
    const n = Number(read())
    if (Number.isFinite(n)) return clampNotebookGraphSideWidth(n)
  } catch {
    /* ignore */
  }
  return NOTEBOOK_GRAPH_SIDE_WIDTH_DEFAULT
}

export function loadNotebookGraphSideCollapsed(
  read = () => localStorage.getItem(SIDE_COLLAPSED_KEY)
): boolean {
  try {
    return read() === '1'
  } catch {
    return false
  }
}

export function persistNotebookGraphSideWidth(
  width: number,
  write = (value: string) => localStorage.setItem(SIDE_WIDTH_KEY, value)
): void {
  try {
    write(String(width))
  } catch {
    /* ignore */
  }
}

export function persistNotebookGraphSideCollapsed(
  collapsed: boolean,
  write = (value: string) => localStorage.setItem(SIDE_COLLAPSED_KEY, value)
): void {
  try {
    write(collapsed ? '1' : '0')
  } catch {
    /* ignore */
  }
}
