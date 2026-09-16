import { normalizeRelativePath } from './workbench-path.util'

export interface WorkbenchCloseableTab {
  id: string
  kind?: string
  relativePath?: string
  change?: { path?: string }
  gitDiffReadOnly?: boolean
  gitDiffCommitHash?: string
}

function isReadonlyGitDiffTab(tab: WorkbenchCloseableTab): boolean {
  return tab.kind === 'git-diff' && Boolean(tab.gitDiffReadOnly || tab.gitDiffCommitHash)
}

/** 磁盘上已消失的文件/目录，应关掉覆盖它的标签页。 */
export function isWorkbenchTabPathDeleted(
  tabPath: string | undefined,
  deletedPath: string
): boolean {
  if (!tabPath) return false
  const tab = normalizeRelativePath(tabPath)
  const deleted = normalizeRelativePath(deletedPath)
  if (!tab || !deleted) return false
  return tab === deleted || tab.startsWith(`${deleted}/`)
}

export function isMissingWorkbenchFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /enoent|no such file|cannot find/i.test(message)
}

export function collectTabIdsForDeletedPath(
  tabs: WorkbenchCloseableTab[],
  deletedPath: string
): string[] {
  return tabs
    .filter((tab) => {
      if (isReadonlyGitDiffTab(tab)) return false
      return (
        isWorkbenchTabPathDeleted(tab.relativePath, deletedPath) ||
        isWorkbenchTabPathDeleted(tab.change?.path, deletedPath)
      )
    })
    .map((tab) => tab.id)
}

export function closeWorkbenchTabs<T extends WorkbenchCloseableTab>(
  tabs: T[],
  activeTabId: string | null,
  tabIdsToClose: Iterable<string>
): { tabs: T[]; activeTabId: string | null } {
  const closing = new Set(tabIdsToClose)
  if (closing.size === 0) return { tabs, activeTabId }
  const remaining = tabs.filter((tab) => !closing.has(tab.id))
  if (remaining.length === tabs.length) return { tabs, activeTabId }
  const nextActive =
    activeTabId && remaining.some((tab) => tab.id === activeTabId)
      ? activeTabId
      : (remaining[remaining.length - 1]?.id ?? null)
  return { tabs: remaining, activeTabId: nextActive }
}

export function applyDeletedPathToWorkbenchTabs<T extends WorkbenchCloseableTab>(
  tabs: T[],
  activeTabId: string | null,
  deletedPath: string
): { tabs: T[]; activeTabId: string | null } {
  return closeWorkbenchTabs(tabs, activeTabId, collectTabIdsForDeletedPath(tabs, deletedPath))
}
