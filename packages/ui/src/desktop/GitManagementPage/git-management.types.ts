import type {
  GitSyncConfig,
  GitCommit,
  GitStatus,
  VersionHistoryEntry,
  FileChange,
  FileDiff,
  GitRollbackAllContext,
  GitStashEntry
} from '@baishou/shared'

export interface GitBranchInfo {
  current: string
  branches: string[]
  hasRemote: boolean
  ahead: number
  behind: number
  remoteUrl?: string
}

export interface GitManagementPageProps {
  // 配置
  config: GitSyncConfig
  onSaveConfig: (config: Partial<GitSyncConfig>) => void | Promise<void>
  // 初始化
  onInit: () => Promise<{ success: boolean; message?: string }>
  isInitialized: boolean
  // 远程
  onTestRemote: () => Promise<boolean>
  /** 仅提交已暂存文件 */
  onCommit: (message: string) => Promise<GitCommit | null>
  /** 无暂存时自动 stage 全部后提交；有暂存时 UI 优先走 onCommit */
  onCommitAll: (message: string) => Promise<GitCommit | null>
  // 提示
  onToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  // 状态
  onGetStatus: () => Promise<GitStatus>
  // 历史
  onGetHistory: (
    filePath?: string,
    limit?: number,
    offset?: number
  ) => Promise<VersionHistoryEntry[]>
  onGetHistoryCount: (filePath?: string) => Promise<number>
  onGetRecentPulls: (limit?: number) => Promise<VersionHistoryEntry[]>
  onGetCommitChanges: (commitHash: string) => Promise<FileChange[]>
  onGetFileDiff: (filePath: string, commitHash?: string) => Promise<FileDiff>
  onGetWorkingDiff: (filePath: string, staged: boolean) => Promise<FileDiff>
  // 暂存操作
  onStageFile: (filePath: string) => Promise<void>
  onStageAll: () => Promise<void>
  onUnstageFile: (filePath: string) => Promise<void>
  onUnstageAll: () => Promise<void>
  onDiscardFile: (filePath: string) => Promise<void>
  onDiscardAllChanges: () => Promise<void>
  // 同步
  onPush: () => Promise<{ success: boolean; message?: string }>
  onPull: () => Promise<{
    success: boolean
    message?: string
    conflicts?: string[]
  }>
  onHasConflicts: () => Promise<boolean>
  onGetConflicts: () => Promise<string[]>
  onResolveConflict: (
    filePath: string,
    resolution: 'ours' | 'theirs'
  ) => Promise<{ success: boolean }>
  // 回滚
  onRollbackFile: (filePath: string, commitHash: string) => Promise<{ success: boolean }>
  onRollbackAll: (commitHash: string) => Promise<{ success: boolean }>
  onGetRollbackAllContext: (commitHash: string) => Promise<GitRollbackAllContext>
  // 工作台 / 分支（可选）
  onGetBranchInfo?: () => Promise<GitBranchInfo>
  onCheckoutBranch?: (branch: string) => Promise<{ success: boolean; message?: string }>
  onCreateBranch?: (branch: string) => Promise<{ success: boolean; message?: string }>
  onSetRemoteUrl?: (url: string) => Promise<{ success: boolean; message?: string }>
  onMergeBranch?: (branch: string) => Promise<{ success: boolean; message?: string }>
  onDeleteBranch?: (
    branch: string,
    force?: boolean
  ) => Promise<{ success: boolean; message?: string }>
  onPublishBranch?: (branch?: string) => Promise<{ success: boolean; message?: string }>
  onListStash?: () => Promise<GitStashEntry[]>
  onStashPush?: (message?: string) => Promise<{ success: boolean; message?: string }>
  onStashApply?: (index: number) => Promise<{ success: boolean; message?: string }>
  onStashPop?: (index: number) => Promise<{ success: boolean; message?: string }>
  onStashDrop?: (index: number) => Promise<{ success: boolean; message?: string }>
  /** 在工作台主编辑区打开 diff（若提供则优先于侧栏内联 diff） */
  onOpenDiffInEditor?: (filePath: string, staged: boolean) => void
  /** 在工作台主编辑区打开某次提交的 diff */
  onOpenCommitDiffInEditor?: (filePath: string, commitHash: string) => void
}
