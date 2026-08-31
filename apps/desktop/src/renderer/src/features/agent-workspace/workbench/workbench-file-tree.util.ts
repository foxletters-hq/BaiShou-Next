/** 与常见侧边栏文件树一致：根行左边距，以及每一级固定缩进。 */
export const WORKBENCH_TREE_DEFAULT_INDENT = 8
export const WORKBENCH_TREE_LEVEL_INDENT = 8

/** 箭头列左边距。同级文件夹与文件共用这个值，图标和名称才能对齐。 */
export function workbenchTreeTwistieOffset(depth: number): number {
  return WORKBENCH_TREE_DEFAULT_INDENT + Math.max(0, depth) * WORKBENCH_TREE_LEVEL_INDENT
}

/** 根目录始终保持展开，只收起其余文件夹。 */
export function collapsedExplorerExpandedPaths(): Set<string> {
  return new Set([''])
}

export function explorerHasCollapsibleFolders(expandedPaths: Iterable<string>): boolean {
  for (const path of expandedPaths) {
    if (path !== '') return true
  }
  return false
}

/** 折叠前记下已展开的文件夹，再次点击时按这份列表恢复。 */
export function snapshotExplorerExpandedPaths(expandedPaths: Iterable<string>): string[] {
  return [...expandedPaths].filter((path) => path !== '')
}

export function restoreExplorerExpandedPaths(snapshot: Iterable<string>): Set<string> {
  const next = collapsedExplorerExpandedPaths()
  for (const path of snapshot) {
    if (path !== '') next.add(path)
  }
  return next
}

export function nextExplorerFolderToggleAction(
  expandedPaths: Iterable<string>
): 'collapse' | 'expand' {
  return explorerHasCollapsibleFolders(expandedPaths) ? 'collapse' : 'expand'
}
