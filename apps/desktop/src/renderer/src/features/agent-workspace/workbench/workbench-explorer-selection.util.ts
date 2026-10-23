import { normalizeRelativePath } from './workbench-path.util'

export const WORKBENCH_REVEAL_PATH_EVENT = 'baishou:workspace-reveal-path'

export interface ExplorerSelectableNode {
  relativePath: string
  isDirectory: boolean
}

export function flattenVisibleExplorerNodes<T extends ExplorerSelectableNode>(
  roots: T[],
  getChildren: (path: string) => T[],
  isExpanded: (path: string) => boolean
): T[] {
  const out: T[] = []
  const walk = (nodes: T[]) => {
    for (const node of nodes) {
      out.push(node)
      if (node.isDirectory && isExpanded(node.relativePath)) {
        walk(getChildren(node.relativePath))
      }
    }
  }
  walk(roots)
  return out
}

export function findExplorerNode<T extends ExplorerSelectableNode>(
  roots: T[],
  relativePath: string,
  getChildren: (path: string) => T[]
): T | undefined {
  const target = normalizeRelativePath(relativePath)
  for (const node of roots) {
    if (normalizeRelativePath(node.relativePath) === target) return node
    if (node.isDirectory) {
      const nested = findExplorerNode(getChildren(node.relativePath), target, getChildren)
      if (nested) return nested
    }
  }
  return undefined
}

export function nextExplorerSelection(params: {
  visiblePaths: string[]
  current: string[]
  clicked: string
  additive: boolean
  range: boolean
  anchor: string | null
}): { selected: string[]; anchor: string } {
  const clicked = normalizeRelativePath(params.clicked)
  const visible = params.visiblePaths.map(normalizeRelativePath)

  if (params.range && params.anchor) {
    const start = visible.indexOf(normalizeRelativePath(params.anchor))
    const end = visible.indexOf(clicked)
    if (start >= 0 && end >= 0) {
      const from = Math.min(start, end)
      const to = Math.max(start, end)
      return {
        selected: visible.slice(from, to + 1),
        anchor: params.anchor
      }
    }
  }

  if (params.additive) {
    const set = new Set(params.current.map(normalizeRelativePath))
    if (set.has(clicked)) set.delete(clicked)
    else set.add(clicked)
    const ordered = visible.filter((path) => set.has(path))
    const leftover = [...set].filter((path) => !ordered.includes(path))
    return { selected: [...ordered, ...leftover], anchor: clicked }
  }

  return { selected: [clicked], anchor: clicked }
}

export function resolveExplorerDragEntries<T extends ExplorerSelectableNode>(
  dragged: T,
  selected: T[]
): T[] {
  if (selected.some((entry) => entry.relativePath === dragged.relativePath)) {
    return selected
  }
  return [dragged]
}

export function resolveExplorerAddToChatEntries<T extends ExplorerSelectableNode>(
  target: T,
  selected: T[]
): T[] {
  if (selected.some((entry) => entry.relativePath === target.relativePath)) {
    return selected
  }
  return [target]
}

export function dispatchWorkbenchRevealPath(
  relativePath: string,
  options?: { isDirectory?: boolean }
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(WORKBENCH_REVEAL_PATH_EVENT, {
      detail: {
        relativePath,
        isDirectory: options?.isDirectory === true
      }
    })
  )
}

export function readWorkbenchRevealPath(
  event: Event
): { relativePath: string; isDirectory: boolean } | null {
  const detail = (event as CustomEvent<{ relativePath?: unknown; isDirectory?: unknown }>).detail
  if (typeof detail?.relativePath !== 'string' || !detail.relativePath.trim()) return null
  return {
    relativePath: detail.relativePath,
    isDirectory: detail.isDirectory === true
  }
}
