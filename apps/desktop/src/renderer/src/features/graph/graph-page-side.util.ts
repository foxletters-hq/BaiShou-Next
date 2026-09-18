export const GRAPH_SIDE_WIDTH_KEY = 'baishou.graph.sideWidth.v1'
export const GRAPH_SIDE_COLLAPSED_KEY = 'baishou.graph.sideCollapsed.v1'
export const GRAPH_SIDE_WIDTH_MIN = 260
export const GRAPH_SIDE_WIDTH_MAX = 560
export const GRAPH_SIDE_WIDTH_DEFAULT = 320

export function clampGraphSideWidth(value: number): number {
  return Math.min(GRAPH_SIDE_WIDTH_MAX, Math.max(GRAPH_SIDE_WIDTH_MIN, value))
}

export function loadGraphSideWidth(
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage
): number {
  try {
    const n = Number(storage?.getItem(GRAPH_SIDE_WIDTH_KEY))
    if (Number.isFinite(n)) {
      return clampGraphSideWidth(n)
    }
  } catch {
    // ignore
  }
  return GRAPH_SIDE_WIDTH_DEFAULT
}

export function loadGraphSideCollapsed(
  storage: Pick<Storage, 'getItem'> | null | undefined = globalThis.localStorage
): boolean {
  try {
    return storage?.getItem(GRAPH_SIDE_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export function saveGraphSideCollapsed(
  collapsed: boolean,
  storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.localStorage
): void {
  try {
    storage?.setItem(GRAPH_SIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // ignore
  }
}

export function saveGraphSideWidth(
  width: number,
  storage: Pick<Storage, 'setItem'> | null | undefined = globalThis.localStorage
): void {
  try {
    storage?.setItem(GRAPH_SIDE_WIDTH_KEY, String(clampGraphSideWidth(width)))
  } catch {
    // ignore
  }
}
