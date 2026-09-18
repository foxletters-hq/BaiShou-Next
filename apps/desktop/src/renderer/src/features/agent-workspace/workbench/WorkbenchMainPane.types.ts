import type { PromptFileRef, WorkspaceChangeEntry } from '@baishou/shared'
import type { WorkbenchActiveSelection } from './workbench-editor-selection.util'

export interface WorkbenchMainPaneHandle {
  openFile: (relativePath: string, options?: { line?: number; column?: number }) => void
  openDiff: (change: WorkspaceChangeEntry) => void
  openDiffs: (changes: WorkspaceChangeEntry[]) => void
  openGitDiff: (filePath: string, options?: { staged?: boolean; commitHash?: string }) => void
  getActiveSelection: () => WorkbenchActiveSelection | null
  dismissSelectionAffordance: () => void
  getOpenFilePaths: () => string[]
}

export interface WorkbenchGitStatusBarProps {
  branch?: string | null
  branches?: string[]
  ahead?: number
  behind?: number
  changesCount?: number
  onCheckoutBranch?: (branch: string) => void
  onCreateBranch?: (branch: string) => void
  onPublishBranch?: () => void
  onRefreshBranches?: () => void
}

export interface WorkbenchMainPaneProps {
  folderRoot: string | null
  onOpenFolder: () => void
  sidePaneVisible: boolean
  agentPanelVisible: boolean
  onToggleSidePane: () => void
  onToggleAgentPanel: () => void
  onTabContentChange?: (tabId: string, content: string, relativePath: string) => void
  gitStatusBar?: WorkbenchGitStatusBarProps
  onAddFileContext?: (ref: PromptFileRef) => void
  onOpenFilePathsChange?: (paths: string[]) => void
}
